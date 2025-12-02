// グローバル変数
let questionsData = [];
let categoriesData = [];
let answeredQuestions = new Set();

// 初期化
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
});

async function initializeApp() {
    try {
        // データベースを開く
        await JeopardyDB.open();
        
        // サンプルデータを読み込む（初回のみ）
        await JeopardyDB.loadSampleData();
        
        // データを読み込み
        await loadData();
        
        // UIを構築
        buildGameGrid();
        
        // イベントリスナーを設定
        setupEventListeners();
        
    } catch (error) {
        console.error('初期化エラー:', error);
        showLoadingError('データの読み込みに失敗しました。');
    }
}

async function loadData() {
    // カテゴリーを取得
    categoriesData = await JeopardyDB.categories.getAll();
    
    // 全問題を取得
    const allQuestions = await JeopardyDB.questions.getAll();
    
    // 有効な問題のみフィルタリング
    questionsData = allQuestions.filter(q => q.enabled);
    
    console.log('カテゴリー:', categoriesData);
    console.log('問題:', questionsData);
}

function showLoadingError(message) {
    const container = document.querySelector('.container');
    container.innerHTML = `
        <div style="text-align: center; padding: 50px; color: #ff6b6b;">
            <h2>エラー</h2>
            <p>${message}</p>
            <p style="margin-top: 20px;">
                <a href="admin.html" style="color: #ffd700;">編集画面で問題を設定してください</a>
            </p>
        </div>
    `;
}

function buildGameGrid() {
    // カテゴリー順でソート済み
    const categories = categoriesData;
    const categoryCount = categories.length;
    
    if (categoryCount === 0) {
        showLoadingError('カテゴリーが設定されていません。');
        return;
    }
    
    // CSS変数でカテゴリー数を設定
    document.documentElement.style.setProperty('--category-count', categoryCount);
    
    // カテゴリーヘッダーを構築
    const categoriesHeader = document.getElementById('categories-header');
    categoriesHeader.innerHTML = '';
    
    categories.forEach(category => {
        const categoryElement = document.createElement('div');
        categoryElement.className = 'category-header';
        categoryElement.textContent = category.name;
        categoriesHeader.appendChild(categoryElement);
    });
    
    // 問題グリッドを構築
    const questionsGrid = document.getElementById('questions-grid');
    questionsGrid.innerHTML = '';
    
    // order 1-5 の各行を作成
    for (let order = 1; order <= 5; order++) {
        categories.forEach(category => {
            const question = questionsData.find(q => 
                q.categoryId === category.id && q.order === order
            );
            
            const cell = document.createElement('div');
            cell.className = 'question-cell';
            
            if (question) {
                cell.textContent = question.points + 'GW';
                cell.dataset.questionId = question.id;
                cell.addEventListener('click', () => showQuestion(question));
            } else {
                cell.textContent = '---';
                cell.style.opacity = '0.3';
                cell.style.cursor = 'not-allowed';
            }
            
            questionsGrid.appendChild(cell);
        });
    }
}

function setupEventListeners() {
    // 正解表示ボタン
    document.getElementById('show-answer-btn').addEventListener('click', async function() {
        const answerContent = document.getElementById('answer-content');
        if (answerContent.style.display === 'none') {
            // 正解表示時にメディアも表示
            if (window.currentQuestion) {
                await displayMedia(window.currentQuestion);
            }
            answerContent.style.display = 'block';
            this.textContent = '正解を隠す';
        } else {
            answerContent.style.display = 'none';
            this.textContent = '正解を表示';
        }
    });
    
    // 一覧に戻るボタン
    document.getElementById('back-to-grid-btn').addEventListener('click', function() {
        showMainScreen();
    });
}

async function showQuestion(question) {
    // 既に回答済みかチェック
    if (answeredQuestions.has(question.id)) {
        return;
    }
    
    // 問題を回答済みとしてマーク
    answeredQuestions.add(question.id);
    updateQuestionCellAppearance(question.id);
    
    // カテゴリー名を取得
    const category = categoriesData.find(c => c.id === question.categoryId);
    const categoryName = category ? category.name : '';
    
    // 問題データを画面に表示
    document.getElementById('question-category').textContent = categoryName;
    document.getElementById('question-id').textContent = `Q${question.order}`;
    document.getElementById('question-points').textContent = question.points + 'GW';
    document.getElementById('question-text').textContent = question.questionText;
    
    // 問題用メディアを表示
    await displayQuestionMedia(question);
    
    // 正解・説明を設定（最初は非表示）
    document.getElementById('answer-text').textContent = question.answerText ? `正解: ${question.answerText}` : '';
    document.getElementById('explanation-text').textContent = question.explanation || '';
    document.getElementById('answer-content').style.display = 'none';
    document.getElementById('show-answer-btn').textContent = '正解を表示';
    
    // 解答用メディアをクリアして、現在の問題を保存
    document.getElementById('media-container').innerHTML = '';
    window.currentQuestion = question;
    
    // 画面を切り替え
    showQuestionScreen();
}

// 問題用メディアを表示
async function displayQuestionMedia(question) {
    const mediaContainer = document.getElementById('question-media-container');
    mediaContainer.innerHTML = '';
    
    if (question.questionMediaId) {
        try {
            const media = await JeopardyDB.media.get(question.questionMediaId);
            if (media) {
                if (media.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = media.data;
                    img.alt = '問題画像';
                    mediaContainer.appendChild(img);
                } else if (media.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.src = media.data;
                    video.controls = true;
                    video.style.maxWidth = '100%';
                    mediaContainer.appendChild(video);
                }
            }
        } catch (error) {
            console.error('問題用メディア読み込みエラー:', error);
        }
    }
}

// 解答用メディアを表示
async function displayMedia(question) {
    const mediaContainer = document.getElementById('media-container');
    mediaContainer.innerHTML = '';
    
    if (question.mediaId) {
        try {
            const media = await JeopardyDB.media.get(question.mediaId);
            if (media) {
                if (media.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = media.data;
                    img.alt = '解答画像';
                    mediaContainer.appendChild(img);
                } else if (media.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.src = media.data;
                    video.controls = true;
                    video.style.maxWidth = '100%';
                    mediaContainer.appendChild(video);
                }
            }
        } catch (error) {
            console.error('解答用メディア読み込みエラー:', error);
        }
    }
}

function updateQuestionCellAppearance(questionId) {
    const cell = document.querySelector(`[data-question-id="${questionId}"]`);
    if (cell) {
        cell.classList.add('answered');
    }
}

function showMainScreen() {
    document.getElementById('main-screen').classList.add('active');
    document.getElementById('question-screen').classList.remove('active');
}

function showQuestionScreen() {
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('question-screen').classList.add('active');
}

// デバッグ用関数（ゲームリセット）
async function resetGame() {
    answeredQuestions.clear();
    await loadData();
    buildGameGrid();
    showMainScreen();
}

// データを再読み込みする関数
async function reloadData() {
    await loadData();
    resetGame();
    console.log('データを再読み込みしました');
}

// グローバルにアクセス可能にする（デバッグ用）
window.resetGame = resetGame;
window.reloadData = reloadData;

console.log('社長室 Jeopardy アプリが正常に読み込まれました！');
console.log('ゲームをリセットする場合は、ブラウザのコンソールで resetGame() を実行してください。');
console.log('データを再読み込みする場合は、ブラウザのコンソールで reloadData() を実行してください。');