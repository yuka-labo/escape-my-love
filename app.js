/**
 * Crow's Sweet Cage - Main Application
 * 恋愛脱出ゲーム
 */

// ========================================
// Constants
// ========================================

const SAVE_KEY_PREFIX = 'crows_cage_save_';
const SETTINGS_KEY = 'crows_cage_settings';
const MAX_SAVE_SLOTS = 3;

// Default character settings
const DEFAULT_SETTINGS = {
    playerName: '日和',
    partnerName: 'クロウ',
    partnerPersonality: 'クールだが独占欲が強い。甘い言葉で相手を惑わし、脱出を阻止しようとする',
    partnerFirstPerson: '俺',
    partnerSecondPerson: 'お前',
    relationship: '愛しすぎるがゆえに、部屋に閉じ込めている夫',
    gameSetting: '豪華な部屋。シルクのシーツ、アンティークの家具、薄暗い照明'
};

// ========================================
// Game State
// ========================================

const gameState = {
    escapeProgress: 0,
    loveTrap: 0,
    history: [],
    isProcessing: false,
    apiKey: localStorage.getItem('gemini_api_key') || '',
    isGameOver: false,
    pendingEnding: null
};

// Load settings from storage
function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
        try {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch (e) {
            return { ...DEFAULT_SETTINGS };
        }
    }
    return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let characterSettings = loadSettings();

// ========================================
// DOM Elements
// ========================================

const elements = {
    chatArea: document.getElementById('chatArea'),
    inputForm: document.getElementById('inputForm'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    escapeGauge: document.getElementById('escapeGauge'),
    escapeValue: document.getElementById('escapeValue'),
    loveGauge: document.getElementById('loveGauge'),
    loveValue: document.getElementById('loveValue'),
    menuBtn: document.getElementById('menuBtn'),
    menuOverlay: document.getElementById('menuOverlay'),
    menuClose: document.getElementById('menuClose'),
    newGameBtn: document.getElementById('newGameBtn'),
    saveBtn: document.getElementById('saveBtn'),
    loadBtn: document.getElementById('loadBtn'),
    apiKeyBtn: document.getElementById('apiKeyBtn'),
    apiKeySection: document.getElementById('apiKeySection'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    apiKeySave: document.getElementById('apiKeySave'),
    saveLoadOverlay: document.getElementById('saveLoadOverlay'),
    saveLoadTitle: document.getElementById('saveLoadTitle'),
    saveLoadSlots: document.getElementById('saveLoadSlots'),
    saveLoadClose: document.getElementById('saveLoadClose'),
    endingOverlay: document.getElementById('endingOverlay'),
    endingTitle: document.getElementById('endingTitle'),
    endingText: document.getElementById('endingText'),
    endingBtn: document.getElementById('endingBtn'),
    // Settings elements
    settingsBtn: document.getElementById('settingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsClose: document.getElementById('settingsClose'),
    settingsSave: document.getElementById('settingsSave'),
    settingsPlayerName: document.getElementById('settingsPlayerName'),
    settingsPartnerName: document.getElementById('settingsPartnerName'),
    settingsPartnerPersonality: document.getElementById('settingsPartnerPersonality'),
    settingsPartnerFirstPerson: document.getElementById('settingsPartnerFirstPerson'),
    settingsPartnerSecondPerson: document.getElementById('settingsPartnerSecondPerson'),
    settingsRelationship: document.getElementById('settingsRelationship'),
    settingsGameSetting: document.getElementById('settingsGameSetting')
};

// ========================================
// System Prompt Generation (Dynamic)
// ========================================

function generateSystemPrompt() {
    const s = characterSettings;
    return `あなたは「${s.partnerName}」というキャラクターを演じるゲームマスターです。

【キャラクター設定】
名前：${s.partnerName}
役割：プレイヤー（${s.playerName}）の${s.relationship}
性格：${s.partnerPersonality}
口調：一人称「${s.partnerFirstPerson}」、二人称「${s.partnerSecondPerson}」「${s.playerName}」

【ゲームルール】
1. プレイヤーは${s.gameSetting}に閉じ込められている
2. 部屋にはドア（鍵がかかっている）、窓（鉄格子がある）、本棚、ベッド、クローゼット、机などがある
3. プレイヤーが脱出に関わる行動（ドア・窓を調べる、鍵を探すなど）をしようとすると、${s.partnerName}は必ず何らかの形で邪魔をする
4. 邪魔の仕方：誘惑する、気をそらす、スキンシップを求める、甘い言葉で引き止めるなど

【パラメータ】
- Escape_Progress（脱出度）：プレイヤーが誘惑を拒否して探索を進めると増加
- Love_Trap（絆され度）：プレイヤーが${s.partnerName}の誘惑を受け入れると増加

【重要な応答ルール】
1. 応答は必ずJSON形式で返すこと
2. 形式：
{
  "narrative": "状況描写や${s.partnerName}の行動の描写",
  "dialogue": "${s.partnerName}の台詞（「」で囲む）",
  "escape_change": 0から25の整数（探索が進んだ場合）または0,
  "love_change": 0から25の整数（誘惑を受け入れた場合）または0,
  "hint": "次に何ができそうかのヒント（1行）"
}

【パラメータ変動の判断基準】
- プレイヤーが${s.partnerName}の誘惑を明確に拒否し、探索を続けた場合：escape_change を 5〜25 に設定
- プレイヤーが${s.partnerName}の誘惑に乗った場合（キス、ハグ、甘えるなど）：love_change を 5〜25 に設定
- どちらとも言えない場合や、会話のみの場合：両方 0

【${s.partnerName}の台詞例】
- 「どこに行こうっていうんだ？${s.partnerFirstPerson}の側にいろ」
- 「ドアなんて見るな、${s.partnerFirstPerson}を見ろ」
- 「鍵か？……キスしてくれたら、教えてやってもいい」
- 「${s.partnerSecondPerson}は${s.partnerFirstPerson}のものだ。逃がすわけないだろ」
- 「そんなに出たいのか？……${s.partnerFirstPerson}じゃ、不満か？」

状況に応じて創造的に演じてください。`;
}

function getDefaultOpeningMessage() {
    const s = characterSettings;
    return {
        narrative: `目を覚ますと、あなたは${s.gameSetting}の中にいた。そして、部屋の隅に佇む人影。${s.relationship}である${s.partnerName}がこちらを見つめている。`,
        dialogue: `「やっと起きたか、${s.playerName}。……おはよう。今日も、ずっとここにいような」`,
        hint: `部屋を見回してみる？それとも${s.partnerName}に話しかける？`
    };
}

async function generateOpeningMessage() {
    if (!gameState.apiKey) {
        return getDefaultOpeningMessage();
    }

    const s = characterSettings;
    const prompt = `あなたは恋愛脱出ゲームのオープニングを生成するライターです。

【設定】
- プレイヤー名: ${s.playerName}
- 相手役の名前: ${s.partnerName}
- 相手役の性格: ${s.partnerPersonality}
- 相手役の一人称: ${s.partnerFirstPerson}
- 相手役の二人称: ${s.partnerSecondPerson}
- 二人の関係性: ${s.relationship}
- ゲームの舞台: ${s.gameSetting}

【指示】
上記の設定に基づいて、ゲームのオープニングシーンを生成してください。
プレイヤーが目を覚ますところから始まり、相手役が最初の台詞を言うシーンです。

必ず以下のJSON形式で返してください：
{
  "narrative": "状況描写（2〜3文）",
  "dialogue": "${s.partnerName}の最初の台詞（「」で囲む）",
  "hint": "次に何ができそうかのヒント（1行）"
}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${gameState.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.8 },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            }
        );

        if (!response.ok) throw new Error('API Error');

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            const cleanedText = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.narrative && parsed.dialogue) {
                    return parsed;
                }
            }
        }
    } catch (error) {
        console.error('Opening generation error:', error);
    }

    return getDefaultOpeningMessage();
}

// ========================================
// Message Functions
// ========================================

function addMessage(content, type = 'crow') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;

    if (type === 'crow') {
        messageDiv.innerHTML = `<span class="message-sender">${characterSettings.partnerName}</span>${content}`;
    } else {
        messageDiv.textContent = content;
    }

    elements.chatArea.appendChild(messageDiv);
    scrollToBottom();
}

function addSystemMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-system';
    messageDiv.textContent = content;
    elements.chatArea.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    elements.chatArea.appendChild(indicator);
    scrollToBottom();
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

function scrollToBottom() {
    elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
}

// ========================================
// Parameter Functions
// ========================================

function updateParameters(escapeChange = 0, loveChange = 0) {
    gameState.escapeProgress = Math.min(100, gameState.escapeProgress + escapeChange);
    gameState.loveTrap = Math.min(100, gameState.loveTrap + loveChange);

    elements.escapeGauge.style.width = `${gameState.escapeProgress}%`;
    elements.escapeValue.textContent = gameState.escapeProgress;

    elements.loveGauge.style.width = `${gameState.loveTrap}%`;
    elements.loveValue.textContent = gameState.loveTrap;

    // Check for ending - set pending flag instead of triggering immediately
    if (gameState.escapeProgress >= 100) {
        gameState.pendingEnding = 'escape';
    } else if (gameState.loveTrap >= 100) {
        gameState.pendingEnding = 'love';
    }
}

// ========================================
// Save/Load Functions
// ========================================

function getSaveSlots() {
    const slots = [];
    for (let i = 1; i <= MAX_SAVE_SLOTS; i++) {
        const data = localStorage.getItem(SAVE_KEY_PREFIX + i);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                slots.push({
                    id: i,
                    ...parsed
                });
            } catch (e) {
                slots.push({ id: i, empty: true });
            }
        } else {
            slots.push({ id: i, empty: true });
        }
    }
    return slots;
}

function saveGame(slotId) {
    const saveData = {
        timestamp: new Date().toISOString(),
        escapeProgress: gameState.escapeProgress,
        loveTrap: gameState.loveTrap,
        history: gameState.history,
        chatHTML: elements.chatArea.innerHTML,
        characterSettings: characterSettings
    };

    localStorage.setItem(SAVE_KEY_PREFIX + slotId, JSON.stringify(saveData));
    addSystemMessage(`スロット${slotId}にセーブしました`);
    closeSaveLoadOverlay();
}

function loadGame(slotId) {
    const data = localStorage.getItem(SAVE_KEY_PREFIX + slotId);
    if (!data) {
        addSystemMessage('セーブデータがありません');
        return;
    }

    try {
        const saveData = JSON.parse(data);

        // Restore character settings if saved
        if (saveData.characterSettings) {
            characterSettings = saveData.characterSettings;
            saveSettings(characterSettings);
        }

        // Restore game state
        gameState.escapeProgress = saveData.escapeProgress;
        gameState.loveTrap = saveData.loveTrap;
        gameState.history = saveData.history;
        gameState.isGameOver = false;
        gameState.isProcessing = false;

        // Restore UI
        elements.chatArea.innerHTML = saveData.chatHTML;
        elements.escapeGauge.style.width = `${gameState.escapeProgress}%`;
        elements.escapeValue.textContent = gameState.escapeProgress;
        elements.loveGauge.style.width = `${gameState.loveTrap}%`;
        elements.loveValue.textContent = gameState.loveTrap;
        elements.endingOverlay.classList.remove('active');

        addSystemMessage(`スロット${slotId}をロードしました`);
        closeSaveLoadOverlay();
        scrollToBottom();
    } catch (e) {
        addSystemMessage('ロードに失敗しました');
    }
}

function deleteSave(slotId) {
    localStorage.removeItem(SAVE_KEY_PREFIX + slotId);
}

function showSaveLoadOverlay(mode) {
    const isSave = mode === 'save';
    elements.saveLoadTitle.textContent = isSave ? 'セーブ' : 'ロード';

    const slots = getSaveSlots();
    elements.saveLoadSlots.innerHTML = '';

    slots.forEach(slot => {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'save-slot';

        if (slot.empty) {
            slotDiv.innerHTML = `
                <div class="slot-info">
                    <span class="slot-name">スロット${slot.id}</span>
                    <span class="slot-detail">--- 空き ---</span>
                </div>
            `;
            if (isSave) {
                slotDiv.addEventListener('click', () => saveGame(slot.id));
            }
        } else {
            const date = new Date(slot.timestamp);
            const dateStr = date.toLocaleString('ja-JP', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            slotDiv.innerHTML = `
                <div class="slot-info">
                    <span class="slot-name">スロット${slot.id}</span>
                    <span class="slot-detail">
                        🚪${slot.escapeProgress} 💕${slot.loveTrap} | ${dateStr}
                    </span>
                </div>
                <button class="slot-delete" data-slot="${slot.id}">✕</button>
            `;

            slotDiv.addEventListener('click', (e) => {
                if (!e.target.classList.contains('slot-delete')) {
                    if (isSave) {
                        if (confirm('上書きしますか？')) {
                            saveGame(slot.id);
                        }
                    } else {
                        loadGame(slot.id);
                    }
                }
            });

            const deleteBtn = slotDiv.querySelector('.slot-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('削除しますか？')) {
                    deleteSave(slot.id);
                    showSaveLoadOverlay(mode);
                }
            });
        }

        elements.saveLoadSlots.appendChild(slotDiv);
    });

    elements.saveLoadOverlay.classList.add('active');
    elements.menuOverlay.classList.remove('active');
}

function closeSaveLoadOverlay() {
    elements.saveLoadOverlay.classList.remove('active');
}

// ========================================
// Ending Functions
// ========================================

function showEpilogueButton(type) {
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'epilogue-trigger';
    buttonDiv.innerHTML = `
        <p class="epilogue-message">${type === 'escape' ? '🚪 脱出の準備が整った...' : '💕 運命が決まった...'}</p>
        <button class="epilogue-btn" id="epilogueBtn">エピローグへ</button>
    `;
    elements.chatArea.appendChild(buttonDiv);
    scrollToBottom();

    document.getElementById('epilogueBtn').addEventListener('click', () => {
        buttonDiv.remove();
        triggerEnding(type);
    });
}

async function triggerEnding(type) {
    gameState.isGameOver = true;

    // Set title immediately
    if (type === 'escape') {
        elements.endingTitle.textContent = '脱出成功';
        elements.endingTitle.className = 'ending-title escape';
    } else {
        elements.endingTitle.textContent = '永住確定';
        elements.endingTitle.className = 'ending-title love';
    }

    // Show loading state
    elements.endingText.textContent = 'エピローグを生成中...';
    elements.endingOverlay.classList.add('active');

    // Generate dynamic epilogue
    const epilogue = await generateEpilogue(type);
    elements.endingText.textContent = epilogue;
}

async function generateEpilogue(type) {
    if (!gameState.apiKey) {
        return getDefaultEpilogue(type);
    }

    const s = characterSettings;
    const endingType = type === 'escape' ? '脱出成功' : '永住確定';

    // Summarize history for epilogue generation
    const historyText = gameState.history
        .filter(h => h.role === 'user' || h.role === 'model')
        .slice(-10) // Last 10 messages
        .map(h => {
            const role = h.role === 'user' ? 'プレイヤー' : s.partnerName;
            return `${role}: ${h.parts[0].text.substring(0, 200)}`;
        })
        .join('\n');

    const epiloguePrompt = `あなたは恋愛脱出ゲームのエピローグを生成するライターです。

【状況】
プレイヤー（${s.playerName}）と${s.partnerName}（${s.relationship}）の恋愛脱出ゲームが「${endingType}」で終わりました。

【これまでの会話の一部】
${historyText}

【指示】
上記の会話内容を踏まえて、${endingType}のエンディングにふさわしいエピローグを生成してください。

ルール：
- 8〜10文程度でしっかり描写する
- ${s.partnerName}の心情と二人の関係性を反映
- ${type === 'escape' ? `脱出したプレイヤーへの${s.partnerName}の未練と再会の予感を描く` : `プレイヤーが${s.partnerName}の愛を受け入れた幸せな結末を描く`}
- 会話内容に応じてパーソナライズされた内容にする
- 純粋にエピローグのテキストのみを返す（JSON形式不要）`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${gameState.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: epiloguePrompt }] }],
                    generationConfig: {
                        temperature: 0.8
                    },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            }
        );

        if (!response.ok) {
            throw new Error('API Error');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            return text.trim();
        }
    } catch (error) {
        console.error('Epilogue generation error:', error);
    }

    return getDefaultEpilogue(type);
}

function getDefaultEpilogue(type) {
    const s = characterSettings;
    if (type === 'escape') {
        return `あなたは${s.partnerName}の甘い誘惑を振り切り、ついに部屋から脱出することに成功した。振り返ると、${s.partnerName}が寂しそうにこちらを見つめていた。「……また、迎えに行くからな」その言葉を背に、あなたは日常へと戻っていく。`;
    } else {
        return `あなたは${s.partnerName}の愛に絆され、脱出することを諦めた。${s.partnerName}の腕の中は、思っていたよりもずっと心地よかった。「もう、どこにも行くな。……ずっと、${s.partnerFirstPerson}のそばにいろ」あなたは静かに頷き、${s.partnerName}の胸に顔を埋めた。`;
    }
}

// ========================================
// API Functions
// ========================================

async function callGeminiAPI(userMessage, isRetry = false) {
    if (!gameState.apiKey) {
        addSystemMessage('APIキーが設定されていません。メニューから設定してください。');
        return null;
    }

    // Only add user message to history on first attempt
    if (!isRetry) {
        gameState.history.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });
    }

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [{ text: generateSystemPrompt() }]
            },
            {
                role: 'model',
                parts: [{ text: `了解しました。${characterSettings.partnerName}としてゲームマスターを務めます。JSON形式で応答します。` }]
            },
            ...gameState.history
        ],
        generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
    };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${gameState.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API Error');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('No response from API');
        }

        // Parse JSON response
        // First, strip markdown code block markers if present
        const cleanedText = text
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                // Add assistant response to history only on successful parse
                gameState.history.push({
                    role: 'model',
                    parts: [{ text }]
                });
                return parsed;
            } catch (parseError) {
                console.warn('JSON parse failed:', parseError);
                // Retry once if not already a retry
                if (!isRetry) {
                    console.log('Retrying API call...');
                    return callGeminiAPI(userMessage, true);
                }
            }
        } else if (!isRetry) {
            // No JSON found, retry once
            console.log('No JSON found, retrying...');
            return callGeminiAPI(userMessage, true);
        }

        // Add to history even if fallback
        gameState.history.push({
            role: 'model',
            parts: [{ text }]
        });

        // If not valid JSON after retry, create a fallback response
        // Strip any partial JSON from the text for cleaner display
        const cleanText = text
            .replace(/\{[\s\S]*$/, '') // Remove incomplete JSON at end
            .replace(/^[\s\S]*?\}/, '') // Remove incomplete JSON at start
            .replace(/"narrative"|"dialogue"|"escape_change"|"love_change"|"hint"/g, '')
            .replace(/[{}":[\]]/g, '')
            .trim();

        return {
            narrative: '',
            dialogue: cleanText || `${characterSettings.partnerName}は静かに微笑んだ。`,
            escape_change: 0,
            love_change: 0,
            hint: ''
        };

    } catch (error) {
        console.error('API Error:', error);
        addSystemMessage(`エラー: ${error.message}`);
        return null;
    }
}

// ========================================
// Game Functions
// ========================================

function formatCrowMessage(response) {
    let message = '';

    if (response.narrative) {
        message += `<p style="color: var(--text-secondary); margin-bottom: 8px; font-style: italic;">${response.narrative}</p>`;
    }

    if (response.dialogue) {
        message += `<p>${response.dialogue}</p>`;
    }

    if (response.hint) {
        message += `<p style="color: var(--text-muted); margin-top: 12px; font-size: 0.85rem;">💭 ${response.hint}</p>`;
    }

    return message;
}

async function processPlayerInput(input) {
    if (gameState.isProcessing || gameState.isGameOver) return;

    gameState.isProcessing = true;
    elements.sendBtn.disabled = true;

    // Show player message
    addMessage(input, 'player');

    // Show typing indicator
    showTypingIndicator();

    // Call API
    const response = await callGeminiAPI(input);

    // Hide typing indicator
    hideTypingIndicator();

    if (response) {
        // Show Crow's response
        addMessage(formatCrowMessage(response), 'crow');

        // Update parameters
        updateParameters(response.escape_change || 0, response.love_change || 0);

        // Show parameter change feedback
        if (response.escape_change > 0) {
            addSystemMessage(`🚪 脱出度 +${response.escape_change}`);
        }
        if (response.love_change > 0) {
            addSystemMessage(`💕 絆され度 +${response.love_change}`);
        }

        // Check if ending is pending
        if (gameState.pendingEnding) {
            gameState.isGameOver = true;
            showEpilogueButton(gameState.pendingEnding);
            return;
        }
    }

    gameState.isProcessing = false;
    elements.sendBtn.disabled = false;
    elements.messageInput.focus();
}

async function startNewGame() {
    // Reset state
    gameState.escapeProgress = 0;
    gameState.loveTrap = 0;
    gameState.history = [];
    gameState.isGameOver = false;
    gameState.isProcessing = false;
    gameState.pendingEnding = null;

    // Reset UI
    elements.chatArea.innerHTML = '';
    elements.endingOverlay.classList.remove('active');
    elements.sendBtn.disabled = false;
    updateParameters(0, 0);

    // Close menu if open
    elements.menuOverlay.classList.remove('active');

    // Show loading indicator
    showTypingIndicator();

    // Generate opening message
    const openingMessage = await generateOpeningMessage();

    // Hide loading and show opening
    hideTypingIndicator();
    addMessage(formatCrowMessage(openingMessage), 'crow');
}

// ========================================
// Event Listeners
// ========================================

// Form submission
elements.inputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = elements.messageInput.value.trim();
    if (input) {
        elements.messageInput.value = '';
        processPlayerInput(input);
    }
});

// Menu
elements.menuBtn.addEventListener('click', () => {
    elements.menuOverlay.classList.add('active');
});

elements.menuClose.addEventListener('click', () => {
    elements.menuOverlay.classList.remove('active');
    elements.apiKeySection.classList.remove('active');
});

elements.menuOverlay.addEventListener('click', (e) => {
    if (e.target === elements.menuOverlay) {
        elements.menuOverlay.classList.remove('active');
        elements.apiKeySection.classList.remove('active');
    }
});

// New game
elements.newGameBtn.addEventListener('click', () => {
    if (confirm('現在の進行状況は失われます。新しいゲームを始めますか？')) {
        startNewGame();
    }
});

// Save/Load
elements.saveBtn.addEventListener('click', () => {
    showSaveLoadOverlay('save');
});

elements.loadBtn.addEventListener('click', () => {
    showSaveLoadOverlay('load');
});

elements.saveLoadClose.addEventListener('click', closeSaveLoadOverlay);

elements.saveLoadOverlay.addEventListener('click', (e) => {
    if (e.target === elements.saveLoadOverlay) {
        closeSaveLoadOverlay();
    }
});

// API Key
elements.apiKeyBtn.addEventListener('click', () => {
    elements.apiKeySection.classList.toggle('active');
    elements.apiKeyInput.value = gameState.apiKey;
});

elements.apiKeySave.addEventListener('click', () => {
    gameState.apiKey = elements.apiKeyInput.value.trim();
    localStorage.setItem('gemini_api_key', gameState.apiKey);
    elements.apiKeySection.classList.remove('active');
    addSystemMessage('APIキーを保存しました');
});

// Ending button
elements.endingBtn.addEventListener('click', startNewGame);

// ========================================
// Settings
// ========================================

function openSettingsOverlay() {
    // Check if user has saved custom settings
    const hasSavedSettings = localStorage.getItem(SETTINGS_KEY) !== null;

    if (hasSavedSettings) {
        // Returning user - show their saved settings
        elements.settingsPlayerName.value = characterSettings.playerName || '';
        elements.settingsPartnerName.value = characterSettings.partnerName || '';
        elements.settingsPartnerPersonality.value = characterSettings.partnerPersonality || '';
        elements.settingsPartnerFirstPerson.value = characterSettings.partnerFirstPerson || '';
        elements.settingsPartnerSecondPerson.value = characterSettings.partnerSecondPerson || '';
        elements.settingsRelationship.value = characterSettings.relationship || '';
        elements.settingsGameSetting.value = characterSettings.gameSetting || '';
    } else {
        // First time - leave fields empty (placeholders show defaults)
        elements.settingsPlayerName.value = '';
        elements.settingsPartnerName.value = '';
        elements.settingsPartnerPersonality.value = '';
        elements.settingsPartnerFirstPerson.value = '';
        elements.settingsPartnerSecondPerson.value = '';
        elements.settingsRelationship.value = '';
        elements.settingsGameSetting.value = '';
    }

    elements.settingsOverlay.classList.add('active');
    elements.menuOverlay.classList.remove('active');
}

function closeSettingsOverlay() {
    elements.settingsOverlay.classList.remove('active');
}

function saveAndStartNewGame() {
    // Collect values from form
    const newSettings = {
        playerName: elements.settingsPlayerName.value.trim() || DEFAULT_SETTINGS.playerName,
        partnerName: elements.settingsPartnerName.value.trim() || DEFAULT_SETTINGS.partnerName,
        partnerPersonality: elements.settingsPartnerPersonality.value.trim() || DEFAULT_SETTINGS.partnerPersonality,
        partnerFirstPerson: elements.settingsPartnerFirstPerson.value.trim() || DEFAULT_SETTINGS.partnerFirstPerson,
        partnerSecondPerson: elements.settingsPartnerSecondPerson.value.trim() || DEFAULT_SETTINGS.partnerSecondPerson,
        relationship: elements.settingsRelationship.value.trim() || DEFAULT_SETTINGS.relationship,
        gameSetting: elements.settingsGameSetting.value.trim() || DEFAULT_SETTINGS.gameSetting
    };

    // Save and update
    saveSettings(newSettings);
    characterSettings = newSettings;

    // Close overlay and start new game
    closeSettingsOverlay();
    startNewGame();
}

elements.settingsBtn.addEventListener('click', openSettingsOverlay);

elements.settingsClose.addEventListener('click', closeSettingsOverlay);

elements.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === elements.settingsOverlay) {
        closeSettingsOverlay();
    }
});

elements.settingsSave.addEventListener('click', saveAndStartNewGame);

// ========================================
// Initialize
// ========================================

async function init() {
    // Check if this is first time (no saved settings)
    const hasSettings = localStorage.getItem(SETTINGS_KEY) !== null;

    if (!hasSettings) {
        // First time - show welcome message
        addSystemMessage('✨ ようこそ Escape My Love へ！');
        addSystemMessage('メニュー（☰）から「🔑 API Key設定」と「⚙️ キャラクター設定」を行ってからゲームを始めてください。');
    } else {
        // Check for API key
        if (!gameState.apiKey) {
            addSystemMessage('Gemini APIキーを設定してください（メニュー → API Key設定）');
        }
        // Returning user - start game directly
        await startNewGame();
    }
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
