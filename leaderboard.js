const Leaderboard = {
    saveScore: (score) => {
        let scores = JSON.parse(localStorage.getItem('snakeLiteScores')) || [];
        const date = new Date().toLocaleDateString();
        scores.push({ score, date });
        
        // Sort descending
        scores.sort((a, b) => b.score - a.score);
        
        // Keep top 5
        scores = scores.slice(0, 5);
        
        localStorage.setItem('snakeLiteScores', JSON.stringify(scores));
    },

    getScores: () => {
        return JSON.parse(localStorage.getItem('snakeLiteScores')) || [];
    }
};

function openLeaderboard() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('leaderboardModal').classList.remove('hidden');
    
    const list = document.getElementById('scoreList');
    list.innerHTML = '';
    const scores = Leaderboard.getScores();
    
    if (scores.length === 0) {
        list.innerHTML = '<li>No games played yet!</li>';
    } else {
        scores.forEach((s, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>#${index + 1} ${s.date}</span> <span>${s.score} pts</span>`;
            list.appendChild(li);
        });
    }
}

function closeLeaderboard() {
    document.getElementById('leaderboardModal').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
}

function openShop() {
    Shop.renderShop();
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('shopModal').classList.remove('hidden');
}

function closeShop() {
    document.getElementById('shopModal').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
}