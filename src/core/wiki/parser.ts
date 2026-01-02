import type { RawCharacterData } from './types';
import { weaponMapping } from '../data/weaponMapping';

/**
 * HTML文字列からキャラクター情報を抽出する
 * @param html WikiページのHTML
 * @param url 元のURL
 */
export function parseWikiHtml(html: string, url: string): RawCharacterData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. 名前 (h1 or title)
    const title = doc.querySelector('title')?.textContent || '';
    // タイトル形式: "江戸城 - 御城プロジェクトRE Wiki" -> "江戸城"
    // 期間イベント等の接頭辞対応: "［絢爛］江戸城 - ..." -> "江戸城"
    let name = title.split('-')[0].trim() || 'Unknown';
    const periodMatch = name.match(/^［(.+?)］(.+)$/);
    if (periodMatch) {
        name = periodMatch[2].trim();
    }

    // 2. テーブル解析による情報抽出
    // Wikiの構造は揺れが大きいため、全てのテーブルを走査して情報を集める
    const tables = Array.from(doc.querySelectorAll('table'));

    // 城娘の基本情報が入っているメインテーブル（城属性を含むもの）
    const hasText = (el: Element | null, keyword: string) => (el?.textContent || '').includes(keyword);

    // 候補: 武器属性セルを含むテーブル（子テーブルの有無は許可、親テーブルでも許可）
    const mainInfoTable = (() => {
        let chosen: HTMLTableElement | null = null;
        for (let i = tables.length - 1; i >= 0; i--) {
            const table = tables[i] as HTMLTableElement;
            const cells = Array.from(table.querySelectorAll('th,td'));
            if (cells.some(c => hasText(c, '武器属性'))) {
                chosen = table;
                break;
            }
        }
        return chosen;
    })();

    let weapon = 'Unknown';
    let rarity: string | undefined;

    // 3. 画像抽出
    // メインテーブル内、またはページ内の name を含む画像を探索
    let imageUrl: string | undefined;

    // 戦略:
    // 1. メインテーブル内の画像で、alt/titleが名前を含むものを優先
    // 2. なければ、ページ全体から探す (ただしヘッダー/フッターは除外したいがDOMParserだと位置不明)
    // 3. 画像URLの補正 (相対パス -> 絶対パス)

    const widthIsSmall = (img: HTMLImageElement) => {
        const w = img.getAttribute('width');
        const h = img.getAttribute('height');
        if (w && parseInt(w) < 60) return true;
        if (h && parseInt(h) < 60) return true;
        return false;
    };

    const getImageSize = (img: HTMLImageElement) => {
        const w = img.getAttribute('width');
        const h = img.getAttribute('height');
        const width = w ? parseInt(w, 10) : null;
        const height = h ? parseInt(h, 10) : null;
        return { width, height };
    };

    const findImage = (scope: Element): string | undefined => {
        const imgs = Array.from(scope.querySelectorAll('img'));

        // 名前と一致する、または "画像" を含むものを候補化
        const candidates = imgs
            .filter(img => {
                const alt = (img.getAttribute('alt') || '').trim();
                const title = (img.getAttribute('title') || '').trim();
                const src = img.getAttribute('src') || '';

                // 明らかなボタン/アイコンは除外
                if (src.includes('icon') || src.includes('button') || widthIsSmall(img)) return false;

                return alt.includes(name) || title.includes(name) || alt.includes('画像') || title.includes('画像');
            })
            .map(img => {
                const { width, height } = getImageSize(img);
                const maxDim = Math.max(width ?? 9999, height ?? 9999);
                const minDim = Math.min(width ?? maxDim, height ?? maxDim);
                const area = (width ?? maxDim) * (height ?? maxDim);
                const isSquareish = width && height ? Math.abs(width - height) <= Math.max(width, height) * 0.25 : false;

                // 優先度: 小さめの正方形アイコン (80〜180px) を最優先。次にその他。大きな立ち絵は最後。
                let priority = 2;
                if (maxDim <= 180 && maxDim >= 80) priority = 0;
                else if (isSquareish) priority = 1;

                return { img, priority, area, maxDim, minDim };
            })
            .sort((a, b) => {
                if (a.priority !== b.priority) return a.priority - b.priority;
                // 同じ優先度なら面積が小さい方を優先（小アイコンを取る）
                return a.area - b.area;
            });

        if (candidates.length > 0) {
            return candidates[0].img.getAttribute('src') || undefined;
        }
        return undefined;
    };

    if (mainInfoTable) {
        imageUrl = findImage(mainInfoTable);
    }

    if (!imageUrl) {
        // メインテーブルで見つからない場合、全体から探す
        // ただし icon などを強く除外する
        imageUrl = findImage(doc.body);
    }

    // URL補正
    if (imageUrl && !imageUrl.startsWith('http')) {
        // url (元のURL) のオリジンを付与
        try {
            const urlObj = new URL(url);
            if (imageUrl.startsWith('/')) {
                imageUrl = `${urlObj.origin}${imageUrl}`;
            } else {
                // 相対パスの場合は適当に結合 (Wikiの構造によるが、ベースタグがない場合はディレクトリ結合)
                // swikiは通常 root からのパスか、プラグイン生成のURL
                // 安全策で origin + / + imageUrl (if not start with /)
                imageUrl = `${urlObj.origin}/${imageUrl}`;
            }
        } catch (e) {
            // urlが無効な場合はそのまま (or ignore)
            console.warn('Invalid base URL for image resolution', url);
        }
    }


    const attributes: string[] = [];
    let attributesLocked = false;
    const baseStats: Record<string, number> = {
        hp: 0,
        attack: 0,
        defense: 0,
        range: 0,
        recovery: 0,
        cooldown: 0,
        cost: 0,
        damage_dealt: 0,
        damage_taken: 0,
        attack_speed: 0,
        attack_gap: 0,
        movement_speed: 0,
        retreat: 0,
        target_count: 0,
        ki_gain: 0,
        damage_drain: 0,
        ignore_defense: 0,
    };
    const skillCandidates: { text: string; header: string }[] = [];
    const strategyCandidates: { text: string; header: string }[] = [];
    const specialCandidates: { text: string; header: string }[] = [];
    const specialAttackCandidates: { text: string; header: string }[] = [];

    const fallbackTable = mainInfoTable ? null : tables[0];
    let currentSection: 'skill' | 'strategy' | 'special' | 'special_attack' | null = null;

    tables.forEach(table => {
        const isMainInfoTable = mainInfoTable ? table === mainInfoTable : false;
        const allowWeaponOrAttrParse = isMainInfoTable || (!mainInfoTable && table === fallbackTable);
        const rows = Array.from(table.querySelectorAll('tr'));
        rows.forEach(row => {
            // ヘッダーと値を抽出
            let header = '';
            let value = '';
            let valueTd: HTMLElement | null = null;

            const th = row.querySelector('th');
            const tds = Array.from(row.querySelectorAll('td'));

            if (th && tds.length > 0) {
                // th + td パターン
                header = th.textContent?.trim() || '';
                value = tds[0].textContent?.trim() || '';
                valueTd = tds[0];
            } else if (tds.length >= 2) {
                // td + td パターン（最初のtdをヘッダーとみなす）
                // ただし、画像のみの場合はヘッダーではない可能性が高い
                const firstTdText = tds[0].textContent?.trim();
                if (firstTdText) {
                    header = firstTdText;
                    value = tds[1].textContent?.trim() || '';
                    valueTd = tds[1];

                    // "初期/巨大化" のように同じステータスが2列並ぶ場合、右側を優先
                    // 例: [耐久][1068/2205][耐久][2242/4630]
                    if (tds.length >= 4) {
                        const thirdTdText = tds[2].textContent?.trim() || '';
                        if (thirdTdText && thirdTdText.replace(/\s+/g, '') === header.replace(/\s+/g, '')) {
                            value = tds[3].textContent?.trim() || value;
                            valueTd = tds[3];
                        }
                    }
                }
            } else if (tds.length === 1) {
                // tdのみのパターン
                value = tds[0].textContent?.trim() || '';
                valueTd = tds[0];
            }

            // --- 情報抽出ロジック ---

            // 武器種
            // ヘッダー・値の両方をチェックする（ヘッダーなしのテーブル対応）
            const weaponPattern = /^(刀|槍|槌|盾|拳|鎌|戦棍|双剣|ランス|弓|石弓|鉄砲|大砲|歌舞|法術|鈴|杖|祓串|本|投剣|鞭|陣貝|茶器|軍船|札|その他)$/;
            const weaponPatternLoose = /^(刀|槍|槌|盾|拳|鎌|戦棍|双剣|ランス|弓|石弓|鉄砲|大砲|歌舞|法術|鈴|杖|祓串|本|投剣|鞭|陣貝|茶器|軍船|札|その他)/;
            // 表記揺れの正規化マップ
            const weaponNormalize: Record<string, string> = {
                '札': '法術',
            };
            const checkWeapon = (text: string) => {
                let cleanWeapon = text.replace(/\(.+?\)/g, '').trim();
                if (weaponPattern.test(cleanWeapon)) {
                    // 表記揺れを正規化
                    cleanWeapon = weaponNormalize[cleanWeapon] ?? cleanWeapon;
                    if (weapon === 'Unknown') {
                        weapon = cleanWeapon;
                    }
                }
            };
            const isWeaponRow =
                /武器/.test(header) ||
                /武器/.test(value) ||
                weaponPatternLoose.test(header) ||
                weaponPatternLoose.test(value) ||
                (!header && !!value);
            if (allowWeaponOrAttrParse && weapon === 'Unknown' && isWeaponRow) {
                checkWeapon(header);
                checkWeapon(value);
            }

            // 画像からの抽出（フォールバック）
            if (allowWeaponOrAttrParse && valueTd && weapon === 'Unknown' && isWeaponRow) {
                const imgs = Array.from(valueTd.querySelectorAll('img'));
                for (const img of imgs) {
                    const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
                    const match = alt.match(weaponPatternLoose);
                    if (match) {
                        // 表記揺れを正規化
                        weapon = weaponNormalize[match[1]] ?? match[1];
                        break;
                    }
                }
            }

            // 城属性
            // ヘッダー・値の両方をチェック
            const checkAttr = (text: string) => {
                // "属性"などの単語を除去して判定
                const cleanText = text.replace(/\s+/g, '').replace(/属性/g, '');

                if (cleanText.includes('平山')) {
                    if (!attributes.includes('平山')) attributes.push('平山');
                } else {
                    if (cleanText.includes('平') && !attributes.includes('平')) attributes.push('平');
                    if (cleanText.includes('山') && !attributes.includes('山')) attributes.push('山');
                    if (cleanText.includes('水') && !attributes.includes('水')) attributes.push('水');
                }
                if (cleanText.includes('地獄') && !attributes.includes('地獄')) attributes.push('地獄');
                if (cleanText.includes('架空') && !attributes.includes('架空')) attributes.push('架空');

                // 無属性判定
                if (cleanText.includes('無') && attributes.length === 0) {
                    if (text.includes('属性') || cleanText.includes('無属性') || cleanText === '無') {
                        attributes.push('無属性');
                    }
                }
            };

            const attrPattern = /(平山|平水|平|山|水|地獄|架空|無属性|無)/;
            const isAttrRow = /属性/.test(header) || /属性/.test(value) || attrPattern.test(header) || attrPattern.test(value) || (!header && !!value);

            if (allowWeaponOrAttrParse && !attributesLocked && isAttrRow) {
                const before = attributes.length;
                checkAttr(header);
                checkAttr(value);
                if (attributes.length > before) {
                    attributesLocked = true; // メインテーブルで取得できたら以降のテーブルでは追加しない
                }
            }

            // 画像(alt/title)からの抽出（フォールバック）
            if (allowWeaponOrAttrParse && valueTd && !attributesLocked && isAttrRow) {
                const imgs = Array.from(valueTd.querySelectorAll('img'));
                imgs.forEach(img => {
                    const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
                    checkAttr(alt);
                });
                if (attributes.length > 0) attributesLocked = true;
            }

            // レアリティ (☆7, 曉, etc.)
            const isRarityRow = /レアリティ/.test(header) || /^☆/.test(value) || /曉/.test(value);
            if (allowWeaponOrAttrParse && !rarity && isRarityRow) {
                // "☆7" or "曉" or "☆7(曉)" などをそのまま取得
                const rarityMatch = value.match(/(☆\d+(?:\s*[\(（].+?[\)）])?|曉|暁)/);
                if (rarityMatch) {
                    rarity = rarityMatch[1];
                }
            }

            // ステータス
            const statMap: Record<string, string> = {
                '耐久': 'hp',
                '攻撃': 'attack',
                '防御': 'defense',
                '射程': 'range',
                '回復': 'recovery',
                '気': 'cost',
            };

            if (isMainInfoTable || !mainInfoTable) {
                for (const [key, statKey] of Object.entries(statMap)) {
                    if (header === key || header.startsWith(key)) {
                        const parseFirstNumber = (text: string | undefined | null) => {
                            if (!text) return undefined;
                            const clean = text.replace(/,/g, '');
                            const m = clean.match(/(\d+(?:\.\d+)?)/);
                            return m ? parseFloat(m[1]) : undefined;
                        };

                        // デフォルトは左列を参照しつつ、右列(巨大化5回)があれば優先
                        let val: number | undefined = parseFirstNumber(value);

                        if (tds.length >= 4) {
                            const rightVal = parseFirstNumber(tds[3].textContent?.trim() || '');
                            if (rightVal !== undefined) {
                                val = rightVal; // 巨大化5回の値を採用
                            }
                        }

                        if (val !== undefined && val > 0) {
                            baseStats[statKey] = val;
                        }
                    }
                }
            }

            // --- State Tracking for Sections ---
            if (tds.length === 1 && header === '') {
                // Section Header (e.g., "特殊能力", "特技", "計略", "特殊攻撃")
                const text = tds[0].textContent?.trim() || '';
                if (text === '特技') currentSection = 'skill';
                else if (text === '計略') currentSection = 'strategy';
                else if (text === '特殊能力') currentSection = 'special';
                else if (text === '特殊攻撃') currentSection = 'special_attack';
                else if (text.length > 1 && !text.startsWith('[')) {
                    // 他のセクション（図鑑文章など）でリセット
                    currentSection = null;
                }
            }

            // 特殊攻撃セクションの判定
            const isSpecialAttack = currentSection === 'special_attack' || header.includes('特殊攻撃') || header.includes('ストック');

            // 特技・計略・特殊能力
            // headerに [無印] や [改壱] が含まれる場合、または "特技" "計略" "特殊能力" という単語が含まれる場合
            const isSkillOrStrategy =
                !isSpecialAttack && (
                    header.includes('[無印]') || header.includes('[改壱]') || header.includes('[改弐]') ||
                    header.includes('特技') || header.includes('計略') || header.includes('特殊能力') ||
                    currentSection === 'special' || currentSection === 'skill' || currentSection === 'strategy'
                );

            if (isSkillOrStrategy) {
                // 計略判定: "気:" や "秒" が含まれる、またはヘッダーに"計略"が含まれる
                // NOTE: 特殊能力も "気:" を含むことがあるため、currentSection または header で除外する
                const isStrategy = currentSection === 'strategy' || header.includes('気:') || header.includes('秒') || header.includes('計略');
                const isSpecial = currentSection === 'special' || header.includes('特殊能力');

                // 説明文の抽出: 値セルだけでなく、その行の他のセルもチェック
                // 構造: | ヘッダー | 名前 | 説明 |

                // 行内のすべてのセルをチェックして、説明文を収集（<br>で分割された複数行を結合）
                const allTexts: string[] = [];

                // バフ説明文と判断するためのキーワードパターン（数字を含むか、特定の効果語で終わる）
                const buffDescriptionPattern = /\d|上昇|増加|低下|減少|軽減|延長|短縮|無効|回復|付与|発動|与える|なる|できる|になる|ダメージ|敵に|範囲内/;

                // 複数のtdがある場合、最後のtdが説明文である可能性が高い
                // 単一のtdの場合は<br>で分割されている可能性がある
                const processCell = (td: Element) => {
                    const html = td.innerHTML;
                    const parts = html.split(/<br\s*\/?>/i);

                    parts.forEach(part => {
                        // HTMLタグを除去
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = part;
                        const text = tempDiv.textContent?.trim() || '';

                        // 計略パラメータ（気:xx, 秒:xx）は除外
                        if (text.includes('気:') || text.includes('秒:')) return;

                        // 短すぎるものは除外
                        if (text.length < 5) return;

                        // 十分長い文章（15文字以上）はバフ説明として扱う
                        // 短いテキストはバフ説明パターンを含む場合のみ採用
                        if (text.length < 15 && !buffDescriptionPattern.test(text)) return;

                        allTexts.push(text);
                    });
                };

                // 複数のtdがある場合、最後のtd（説明文）のみを処理
                // 単一のtdの場合はそれを処理（<br>で複数行の効果が含まれる可能性）
                if (tds.length > 1) {
                    // 最後のtdを処理（通常は説明文が入っている）
                    processCell(tds[tds.length - 1]);
                } else if (tds.length === 1) {
                    processCell(tds[0]);
                }

                // すべてのテキストを結合して説明文とする
                const combinedText = allTexts.join(' ');
                if (combinedText.length > 5) {
                    const bucket = isSpecial ? specialCandidates : (isStrategy ? strategyCandidates : skillCandidates);
                    // 重複防止
                    if (!bucket.some(c => c.text === combinedText)) {
                        bucket.push({ text: combinedText, header });
                    }
                }
            }

            // 特殊攻撃テキストの収集
            // [無印] または [改壱] で始まるヘッダーの行のみ対象
            const isSpecialAttackRow = isSpecialAttack && value.length > 5 &&
                (header.startsWith('[無印]') || header.startsWith('[改壱]') || header.startsWith('[改弐]'));
            if (isSpecialAttackRow) {
                // 特殊攻撃の説明テキストを抽出（「攻撃の6倍」「防御無視」など）
                const allTexts: string[] = [];
                const processCell = (td: Element) => {
                    const html = td.innerHTML;
                    const parts = html.split(/<br\s*\/?>/i);
                    parts.forEach(part => {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = part;
                        const text = tempDiv.textContent?.trim() || '';
                        if (text.length >= 3) {
                            allTexts.push(text);
                        }
                    });
                };
                if (tds.length > 1) {
                    processCell(tds[tds.length - 1]);
                } else if (tds.length === 1) {
                    processCell(tds[0]);
                }
                const combinedText = allTexts.join(' ');
                if (combinedText.length > 3 && !specialAttackCandidates.some(c => c.text === combinedText)) {
                    specialAttackCandidates.push({ text: combinedText, header });
                }
            }
        });
    });

    // 武器種マッピングは共通モジュールから取得

    let weaponRange: '近' | '遠' | '遠近' | undefined;
    let weaponType: '物' | '術' | undefined;
    let placement: '近' | '遠' | '遠近' | undefined;
    let period: string | undefined;

    if (periodMatch) {
        period = periodMatch[1];
    }

    if (weapon !== 'Unknown' && weaponMapping[weapon]) {
        const info = weaponMapping[weapon];
        // 共通マッピングの range は '近' | '遠' だが、parser では placement を weaponRange として扱う
        weaponRange = info.placement;
        weaponType = info.type;
        placement = info.placement;
    }

    // 余分な説明（CV・セリフ・コメント等）を除去
    const cleanDescription = (text: string): string | null => {
        if (!text) return null;
        const cutIndex = text.search(/キャラクターボイス|台詞|クリックすると|贈り物イベント|コメント|画像/);
        const trimmed = (cutIndex >= 0 ? text.slice(0, cutIndex) : text).replace(/\s+/g, ' ').trim();
        if (trimmed === '' || trimmed.length <= 1) return null;
        return trimmed;
    };

    // 改壱があればそれを優先して採用し、不要部分をクリーンアップ
    const pickTexts = (arr: { text: string; header: string }[]) => {
        const kai = arr.filter(c => c.header.includes('改壱') || c.header.includes('改弐'));
        const src = kai.length > 0 ? kai : arr;
        return src
            .map(c => cleanDescription(c.text))
            .filter((t): t is string => !!t);
    };

    const skillTexts = pickTexts(skillCandidates);
    const strategyTexts = pickTexts(strategyCandidates);
    const specialTexts = pickTexts(specialCandidates);
    // 特殊攻撃は改壱を優先しつつ、全テキストを連結
    const specialAttackTexts = pickTexts(specialAttackCandidates);

    return {
        name,
        period,
        url,
        weapon,
        weaponRange,
        weaponType,
        placement,
        rarity,
        attributes: [...new Set(attributes)],
        baseStats,
        skillTexts: [...new Set(skillTexts)], // 重複排除
        strategyTexts: [...new Set(strategyTexts)], // 重複排除
        specialTexts: [...new Set(specialTexts)],
        specialAttackTexts: [...new Set(specialAttackTexts)],
        imageUrl,
    };
}
