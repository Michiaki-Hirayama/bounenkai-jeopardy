// IndexedDB データベース管理
const DB_NAME = 'JeopardyDB';
const DB_VERSION = 1;

let db = null;

// データベースを開く
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            // カテゴリーストア
            if (!database.objectStoreNames.contains('categories')) {
                const categoryStore = database.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
                categoryStore.createIndex('order', 'order', { unique: false });
            }
            
            // 問題ストア
            if (!database.objectStoreNames.contains('questions')) {
                const questionStore = database.createObjectStore('questions', { keyPath: 'id', autoIncrement: true });
                questionStore.createIndex('categoryId', 'categoryId', { unique: false });
                questionStore.createIndex('order', 'order', { unique: false });
            }
            
            // メディアストア（画像・動画）
            if (!database.objectStoreNames.contains('media')) {
                database.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// ========== カテゴリー操作 ==========

// 全カテゴリーを取得
function getAllCategories() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['categories'], 'readonly');
        const store = transaction.objectStore('categories');
        const request = store.getAll();
        
        request.onsuccess = () => {
            const categories = request.result.sort((a, b) => a.order - b.order);
            resolve(categories);
        };
        request.onerror = () => reject(request.error);
    });
}

// カテゴリーを追加
function addCategory(name) {
    return new Promise(async (resolve, reject) => {
        const categories = await getAllCategories();
        const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order)) : 0;
        
        const transaction = db.transaction(['categories'], 'readwrite');
        const store = transaction.objectStore('categories');
        const request = store.add({
            name: name,
            order: maxOrder + 1
        });
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// カテゴリーを更新
function updateCategory(id, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['categories'], 'readwrite');
        const store = transaction.objectStore('categories');
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
            const category = { ...getRequest.result, ...data };
            const putRequest = store.put(category);
            putRequest.onsuccess = () => resolve(category);
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// カテゴリーを削除
function deleteCategory(id) {
    return new Promise(async (resolve, reject) => {
        // 関連する問題も削除
        const questions = await getQuestionsByCategory(id);
        for (const q of questions) {
            await deleteQuestion(q.id);
        }
        
        const transaction = db.transaction(['categories'], 'readwrite');
        const store = transaction.objectStore('categories');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// カテゴリーの順番を更新
function updateCategoryOrders(orderedIds) {
    return new Promise(async (resolve, reject) => {
        const transaction = db.transaction(['categories'], 'readwrite');
        const store = transaction.objectStore('categories');
        
        for (let i = 0; i < orderedIds.length; i++) {
            const getRequest = store.get(orderedIds[i]);
            getRequest.onsuccess = () => {
                const category = getRequest.result;
                category.order = i + 1;
                store.put(category);
            };
        }
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// ========== 問題操作 ==========

// 全問題を取得
function getAllQuestions() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['questions'], 'readonly');
        const store = transaction.objectStore('questions');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// カテゴリー別に問題を取得
function getQuestionsByCategory(categoryId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['questions'], 'readonly');
        const store = transaction.objectStore('questions');
        const index = store.index('categoryId');
        const request = index.getAll(categoryId);
        
        request.onsuccess = () => {
            const questions = request.result.sort((a, b) => a.order - b.order);
            resolve(questions);
        };
        request.onerror = () => reject(request.error);
    });
}

// 問題を追加
function addQuestion(questionData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');
        const request = store.add({
            ...questionData,
            enabled: true,
            createdAt: new Date().toISOString()
        });
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 問題を更新
function updateQuestion(id, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
            const question = { ...getRequest.result, ...data, updatedAt: new Date().toISOString() };
            const putRequest = store.put(question);
            putRequest.onsuccess = () => resolve(question);
            putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// 問題を削除
function deleteQuestion(id) {
    return new Promise(async (resolve, reject) => {
        // 関連するメディアも削除
        const question = await getQuestion(id);
        if (question) {
            // 問題用メディアを削除
            if (question.questionMediaId) {
                await deleteMedia(question.questionMediaId);
            }
            // 解答用メディアを削除
            if (question.mediaId) {
                await deleteMedia(question.mediaId);
            }
        }
        
        const transaction = db.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// 問題を1件取得
function getQuestion(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['questions'], 'readonly');
        const store = transaction.objectStore('questions');
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ========== メディア操作 ==========

// メディアを追加
function addMedia(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
            const transaction = db.transaction(['media'], 'readwrite');
            const store = transaction.objectStore('media');
            const request = store.add({
                name: file.name,
                type: file.type,
                data: reader.result,
                createdAt: new Date().toISOString()
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        };
        
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

// メディアを取得
function getMedia(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// メディアを削除
function deleteMedia(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ========== エクスポート/インポート ==========

// 全データをエクスポート
async function exportAllData() {
    const categories = await getAllCategories();
    const questions = await getAllQuestions();
    
    // メディアデータも含める（問題用・解答用両方）
    const questionsWithMedia = await Promise.all(questions.map(async (q) => {
        const result = { ...q };
        
        // 問題用メディア
        if (q.questionMediaId) {
            const questionMedia = await getMedia(q.questionMediaId);
            result.questionMediaData = questionMedia;
        }
        
        // 解答用メディア
        if (q.mediaId) {
            const answerMedia = await getMedia(q.mediaId);
            result.mediaData = answerMedia;
        }
        
        return result;
    }));
    
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        categories: categories,
        questions: questionsWithMedia
    };
}

// データをインポート
async function importAllData(data) {
    // 既存データをクリア
    await clearAllData();
    
    // カテゴリーをインポート
    const categoryIdMap = {};
    for (const cat of data.categories) {
        const oldId = cat.id;
        delete cat.id;
        const newId = await addCategoryDirect(cat);
        categoryIdMap[oldId] = newId;
    }
    
    // 問題をインポート
    for (const q of data.questions) {
        const oldCategoryId = q.categoryId;
        q.categoryId = categoryIdMap[oldCategoryId];
        
        // 問題用メディアデータがあればインポート
        if (q.questionMediaData) {
            const questionMediaId = await addMediaDirect(q.questionMediaData);
            q.questionMediaId = questionMediaId;
            delete q.questionMediaData;
        }
        
        // 解答用メディアデータがあればインポート
        if (q.mediaData) {
            const mediaId = await addMediaDirect(q.mediaData);
            q.mediaId = mediaId;
            delete q.mediaData;
        }
        
        delete q.id;
        await addQuestionDirect(q);
    }
}

// 直接追加（ID自動生成用）
function addCategoryDirect(data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['categories'], 'readwrite');
        const store = transaction.objectStore('categories');
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function addQuestionDirect(data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function addMediaDirect(data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        delete data.id;
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 全データをクリア
function clearAllData() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['categories', 'questions', 'media'], 'readwrite');
        
        transaction.objectStore('categories').clear();
        transaction.objectStore('questions').clear();
        transaction.objectStore('media').clear();
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// ========== サンプルデータ ==========

async function loadSampleData() {
    const categories = await getAllCategories();
    if (categories.length > 0) {
        return; // 既にデータがあれば何もしない
    }
    
    // サンプルカテゴリー
    const cat1Id = await addCategory('社長系');
    const cat2Id = await addCategory('社長室トリビア系');
    const cat3Id = await addCategory('知識系');
    
    // サンプル問題
    const sampleQuestions = [
        { categoryId: cat1Id, order: 1, points: 10, questionText: '孫社長がソフトバンクを創業した年は？', answerText: '1981年', explanation: '創業は1981年で、ソフトバンクの原点になっている年です。' },
        { categoryId: cat1Id, order: 2, points: 20, questionText: 'ソフトバンクの社名の由来となった「バンク」は何を意味している？', answerText: '情報の銀行', explanation: '孫社長は「情報を扱う銀行のような会社にしたい」という想いから命名しました。' },
        { categoryId: cat1Id, order: 3, points: 30, questionText: '孫社長が最初に起業した会社の事業内容は？', answerText: '翻訳機の開発・販売', explanation: '大学時代に音声翻訳機を開発し、シャープに1億円で売却しました。' },
        { categoryId: cat1Id, order: 4, points: 40, questionText: 'Vision Fundの総額は約何兆円？', answerText: '10兆円', explanation: '世界最大規模のテック投資ファンドです。' },
        { categoryId: cat1Id, order: 5, points: 50, questionText: '孫社長の座右の銘は？', answerText: '志高く', explanation: '「志を高く持ち、常に挑戦し続ける」という意味が込められています。' },
        
        { categoryId: cat2Id, order: 1, points: 10, questionText: '社長室がある東京本社の正式な住所の区は？', answerText: '港区', explanation: '東京都港区東新橋にあります。' },
        { categoryId: cat2Id, order: 2, points: 20, questionText: 'ソフトバンクのロゴマークは何をモチーフにしている？', answerText: '銀杏の葉', explanation: '日本の象徴である銀杏の葉をモチーフにしています。' },
        { categoryId: cat2Id, order: 3, points: 30, questionText: 'ソフトバンクの企業理念「情報革命で人々を幸せに」が制定されたのは何年？', answerText: '2010年', explanation: '会社の方向性を明確にするため制定されました。' },
        { categoryId: cat2Id, order: 4, points: 40, questionText: 'ソフトバンクグループの決算説明会で孫社長がよく使うプレゼンテーションソフトは？', answerText: 'PowerPoint', explanation: '数百枚のスライドを使った熱のこもったプレゼンで有名です。' },
        { categoryId: cat2Id, order: 5, points: 50, questionText: '孫社長が愛用している移動手段で有名なものは？', answerText: '自家用ジェット', explanation: 'グローバルなビジネス展開のため効率的な移動を重視しています。' },
        
        { categoryId: cat3Id, order: 1, points: 10, questionText: 'ソフトバンクグループが推進しているAI革命で重視している要素は？', answerText: 'データ・アルゴリズム・コンピューティングパワー', explanation: 'AI革命の3大要素として挙げられています。' },
        { categoryId: cat3Id, order: 2, points: 20, questionText: 'ARMが設計しているプロセッサは主にどの分野で使われている？', answerText: 'スマートフォン・IoTデバイス', explanation: '世界のスマートフォンの95%以上でARM設計のチップが使われています。' },
        { categoryId: cat3Id, order: 3, points: 30, questionText: 'ソフトバンクが2016年に約3.3兆円で買収した半導体企業は？', answerText: 'ARM Holdings', explanation: 'イギリスの半導体設計会社で、IoT時代の中核企業です。' },
        { categoryId: cat3Id, order: 4, points: 40, questionText: 'WeWorkの創業者は？', answerText: 'アダム・ニューマン', explanation: 'ソフトバンクが大規模投資を行ったコワーキングスペース企業です。' },
        { categoryId: cat3Id, order: 5, points: 50, questionText: 'ソフトバンクが投資している配車サービス企業を2つ挙げてください', answerText: 'Uber・Didi・Grab', explanation: '世界各地の主要な配車サービスに投資しています。' },
    ];
    
    for (const q of sampleQuestions) {
        await addQuestion(q);
    }
    
    console.log('サンプルデータを読み込みました');
}

// グローバルにエクスポート
window.JeopardyDB = {
    open: openDatabase,
    categories: {
        getAll: getAllCategories,
        add: addCategory,
        update: updateCategory,
        delete: deleteCategory,
        updateOrders: updateCategoryOrders
    },
    questions: {
        getAll: getAllQuestions,
        getByCategory: getQuestionsByCategory,
        get: getQuestion,
        add: addQuestion,
        update: updateQuestion,
        delete: deleteQuestion
    },
    media: {
        add: addMedia,
        get: getMedia,
        delete: deleteMedia
    },
    exportData: exportAllData,
    importData: importAllData,
    clearAll: clearAllData,
    loadSampleData: loadSampleData
};
