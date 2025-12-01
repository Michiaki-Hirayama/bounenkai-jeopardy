// ログイン認証情報
const VALID_ID = 'ceoo';
const VALID_PASSWORD = 'bounenkai';

// DOM読み込み完了後
document.addEventListener('DOMContentLoaded', function() {
    // 既にログイン済みならゲーム画面へリダイレクト
    if (sessionStorage.getItem('jeopardy_logged_in') === 'true') {
        window.location.href = 'index.html';
        return;
    }
    
    // フォーム送信イベント
    document.getElementById('login-form').addEventListener('submit', handleLogin);
});

function handleLogin(event) {
    event.preventDefault();
    
    const userId = document.getElementById('user-id').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    // 認証チェック
    if (userId === VALID_ID && password === VALID_PASSWORD) {
        // ログイン成功
        sessionStorage.setItem('jeopardy_logged_in', 'true');
        window.location.href = 'index.html';
    } else {
        // ログイン失敗
        errorMessage.textContent = 'IDまたはパスワードが正しくありません';
        document.getElementById('password').value = '';
        
        // エラーメッセージを3秒後にクリア
        setTimeout(() => {
            errorMessage.textContent = '';
        }, 3000);
    }
}

