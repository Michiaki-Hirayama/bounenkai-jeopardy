// 編集画面のロジック
let currentQuestionId = null;
let currentMediaId = null;

// 初期化
document.addEventListener('DOMContentLoaded', async function() {
    await JeopardyDB.open();
    await JeopardyDB.loadSampleData();
    
    await renderCategories();
    await renderQuestions();
    
    setupEventListeners();
});

// イベントリスナーを設定
function setupEventListeners() {
    // カテゴリー追加
    document.getElementById('add-category-btn').addEventListener('click', addCategory);
    document.getElementById('new-category-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addCategory();
    });
    
    // エクスポート
    document.getElementById('export-btn').addEventListener('click', exportData);
    
    // インポート
    document.getElementById('import-input').addEventListener('change', importData);
    
    // 全データ削除
    document.getElementById('reset-btn').addEventListener('click', resetAllData);
    
    // メディアアップロード
    document.getElementById('question-media').addEventListener('change', handleMediaUpload);
    
    // メディア削除
    document.getElementById('remove-media-btn').addEventListener('click', removeMedia);
}

// ========== カテゴリー管理 ==========

async function renderCategories() {
    const categories = await JeopardyDB.categories.getAll();
    const container = document.getElementById('category-list');
    
    container.innerHTML = categories.map((cat, index) => `
        <div class="category-item" data-id="${cat.id}">
            <span class="category-name">${cat.name}</span>
            <div class="category-actions">
                <button class="move-btn" onclick="moveCategoryUp(${cat.id})" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="move-btn" onclick="moveCategoryDown(${cat.id})" ${index === categories.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory(${cat.id})">削除</button>
            </div>
        </div>
    `).join('');
}

async function addCategory() {
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    
    if (!name) {
        alert('カテゴリー名を入力してください');
        return;
    }
    
    await JeopardyDB.categories.add(name);
    input.value = '';
    
    await renderCategories();
    await renderQuestions();
}

async function deleteCategory(id) {
    if (!confirm('このカテゴリーと関連する問題をすべて削除しますか？')) {
        return;
    }
    
    await JeopardyDB.categories.delete(id);
    await renderCategories();
    await renderQuestions();
}

async function moveCategoryUp(id) {
    const categories = await JeopardyDB.categories.getAll();
    const index = categories.findIndex(c => c.id === id);
    
    if (index > 0) {
        const orderedIds = categories.map(c => c.id);
        [orderedIds[index], orderedIds[index - 1]] = [orderedIds[index - 1], orderedIds[index]];
        await JeopardyDB.categories.updateOrders(orderedIds);
        await renderCategories();
        await renderQuestions();
    }
}

async function moveCategoryDown(id) {
    const categories = await JeopardyDB.categories.getAll();
    const index = categories.findIndex(c => c.id === id);
    
    if (index < categories.length - 1) {
        const orderedIds = categories.map(c => c.id);
        [orderedIds[index], orderedIds[index + 1]] = [orderedIds[index + 1], orderedIds[index]];
        await JeopardyDB.categories.updateOrders(orderedIds);
        await renderCategories();
        await renderQuestions();
    }
}

// ========== 問題管理 ==========

async function renderQuestions() {
    const categories = await JeopardyDB.categories.getAll();
    const container = document.getElementById('questions-container');
    
    let html = '';
    
    for (const cat of categories) {
        const questions = await JeopardyDB.questions.getByCategory(cat.id);
        
        html += `
            <div class="category-questions">
                <h3>
                    ${cat.name}
                    <button class="btn btn-sm btn-success" onclick="openNewQuestionModal(${cat.id})">+ 問題追加</button>
                </h3>
                <div class="question-grid">
                    ${questions.map(q => `
                        <div class="question-card ${q.enabled ? '' : 'disabled'}" onclick="openEditQuestionModal(${q.id})">
                            <div class="points">${q.points}GW</div>
                            <div class="preview">${q.questionText}</div>
                            ${q.mediaId ? '<div class="has-media">📎</div>' : ''}
                        </div>
                    `).join('')}
                    <div class="question-card add-question-card" onclick="openNewQuestionModal(${cat.id})">
                        +
                    </div>
                </div>
            </div>
        `;
    }
    
    if (categories.length === 0) {
        html = '<p style="text-align: center; color: #999;">カテゴリーを追加してください</p>';
    }
    
    container.innerHTML = html;
}

// ========== モーダル操作 ==========

async function openNewQuestionModal(categoryId) {
    currentQuestionId = null;
    currentMediaId = null;
    
    document.getElementById('modal-title').textContent = '新しい問題を追加';
    document.getElementById('question-id').value = '';
    
    // カテゴリーセレクトを更新
    await updateCategorySelect(categoryId);
    
    // フォームをリセット
    document.getElementById('question-order').value = '';
    document.getElementById('question-points').value = '10';
    document.getElementById('question-text').value = '';
    document.getElementById('question-answer').value = '';
    document.getElementById('question-explanation').value = '';
    document.getElementById('question-enabled').checked = true;
    document.getElementById('question-media').value = '';
    document.getElementById('media-preview').innerHTML = '';
    document.getElementById('remove-media-btn').style.display = 'none';
    
    document.getElementById('question-modal').style.display = 'flex';
}

async function openEditQuestionModal(questionId) {
    const question = await JeopardyDB.questions.get(questionId);
    if (!question) return;
    
    currentQuestionId = questionId;
    currentMediaId = question.mediaId || null;
    
    document.getElementById('modal-title').textContent = '問題を編集';
    document.getElementById('question-id').value = questionId;
    
    // カテゴリーセレクトを更新
    await updateCategorySelect(question.categoryId);
    
    // フォームに値をセット
    document.getElementById('question-order').value = question.order;
    document.getElementById('question-points').value = question.points;
    document.getElementById('question-text').value = question.questionText;
    document.getElementById('question-answer').value = question.answerText;
    document.getElementById('question-explanation').value = question.explanation || '';
    document.getElementById('question-enabled').checked = question.enabled;
    document.getElementById('question-media').value = '';
    
    // メディアプレビュー
    if (question.mediaId) {
        const media = await JeopardyDB.media.get(question.mediaId);
        if (media) {
            showMediaPreview(media);
        }
    } else {
        document.getElementById('media-preview').innerHTML = '';
        document.getElementById('remove-media-btn').style.display = 'none';
    }
    
    document.getElementById('question-modal').style.display = 'flex';
}

async function updateCategorySelect(selectedId) {
    const categories = await JeopardyDB.categories.getAll();
    const select = document.getElementById('question-category');
    
    select.innerHTML = categories.map(cat => 
        `<option value="${cat.id}" ${cat.id === selectedId ? 'selected' : ''}>${cat.name}</option>`
    ).join('');
}

function closeModal() {
    document.getElementById('question-modal').style.display = 'none';
    currentQuestionId = null;
    currentMediaId = null;
}

async function saveQuestion() {
    const categoryId = parseInt(document.getElementById('question-category').value);
    const order = parseInt(document.getElementById('question-order').value);
    const points = parseInt(document.getElementById('question-points').value);
    const questionText = document.getElementById('question-text').value.trim();
    const answerText = document.getElementById('question-answer').value.trim();
    const explanation = document.getElementById('question-explanation').value.trim();
    const enabled = document.getElementById('question-enabled').checked;
    
    if (!questionText || !answerText) {
        alert('問題文と正解は必須です');
        return;
    }
    
    if (order < 1 || order > 5) {
        alert('順番は1から5の間で入力してください');
        return;
    }
    
    const questionData = {
        categoryId,
        order,
        points,
        questionText,
        answerText,
        explanation,
        enabled,
        mediaId: currentMediaId
    };
    
    if (currentQuestionId) {
        await JeopardyDB.questions.update(currentQuestionId, questionData);
    } else {
        await JeopardyDB.questions.add(questionData);
    }
    
    closeModal();
    await renderQuestions();
}

async function deleteQuestion(id) {
    if (!confirm('この問題を削除しますか？')) {
        return;
    }
    
    await JeopardyDB.questions.delete(id);
    closeModal();
    await renderQuestions();
}

// ========== メディア操作 ==========

async function handleMediaUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // ファイルサイズチェック（1GB制限）
    if (file.size > 1024 * 1024 * 1024) {
        alert('ファイルサイズは1GB以下にしてください');
        event.target.value = '';
        return;
    }
    
    // 古いメディアがあれば削除予約
    if (currentMediaId) {
        await JeopardyDB.media.delete(currentMediaId);
    }
    
    // 新しいメディアを保存
    const mediaId = await JeopardyDB.media.add(file);
    currentMediaId = mediaId;
    
    // プレビュー表示
    const media = await JeopardyDB.media.get(mediaId);
    showMediaPreview(media);
}

function showMediaPreview(media) {
    const preview = document.getElementById('media-preview');
    
    if (media.type.startsWith('image/')) {
        preview.innerHTML = `<img src="${media.data}" alt="プレビュー">`;
    } else if (media.type.startsWith('video/')) {
        preview.innerHTML = `<video src="${media.data}" controls></video>`;
    }
    
    document.getElementById('remove-media-btn').style.display = 'inline-block';
}

async function removeMedia() {
    if (currentMediaId) {
        await JeopardyDB.media.delete(currentMediaId);
        currentMediaId = null;
    }
    
    document.getElementById('media-preview').innerHTML = '';
    document.getElementById('question-media').value = '';
    document.getElementById('remove-media-btn').style.display = 'none';
}

// ========== データ管理 ==========

async function exportData() {
    const data = await JeopardyDB.exportData();
    const json = JSON.stringify(data, null, 2);
    
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `jeopardy_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('データをエクスポートしました');
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!confirm('現在のデータをすべて上書きしますか？')) {
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            await JeopardyDB.importData(data);
            
            await renderCategories();
            await renderQuestions();
            
            alert('データをインポートしました');
        } catch (error) {
            console.error('インポートエラー:', error);
            alert('インポートに失敗しました。ファイル形式を確認してください。');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

async function resetAllData() {
    if (!confirm('すべてのデータを削除しますか？この操作は取り消せません。')) {
        return;
    }
    
    if (!confirm('本当に削除しますか？')) {
        return;
    }
    
    await JeopardyDB.clearAll();
    await renderCategories();
    await renderQuestions();
    
    alert('すべてのデータを削除しました');
}

// グローバル関数
window.moveCategoryUp = moveCategoryUp;
window.moveCategoryDown = moveCategoryDown;
window.deleteCategory = deleteCategory;
window.openNewQuestionModal = openNewQuestionModal;
window.openEditQuestionModal = openEditQuestionModal;
window.closeModal = closeModal;
window.saveQuestion = saveQuestion;
window.deleteQuestion = deleteQuestion;
window.removeMedia = removeMedia;
