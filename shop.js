const Shop = {
    skins: [
        { id: 'green', name: 'Classic Green', color: '#4CAF50', price: 0 },
        { id: 'blue', name: 'Ocean Blue', color: '#2196F3', price: 100 },
        { id: 'red', name: 'Magma Red', color: '#f44336', price: 250 },
        { id: 'purple', name: 'Neon Purple', color: '#9C27B0', price: 500 },
        { id: 'gold', name: 'Midas Gold', color: '#FFD700', price: 1000 }
    ],

    data: {
        coins: 2000, // Default start
        unlocked: ['green'],
        equipped: 'green',
        bonusGiven: false
    },

    init: function() {
        const saved = localStorage.getItem('snakeLiteShop');
        if (saved) {
            this.data = JSON.parse(saved);
            
            // FIX: If user played before but didn't get the bonus/has 0 coins, give it now
            if (!this.data.bonusGiven && this.data.coins < 2000) {
                this.data.coins = 2000;
                this.data.bonusGiven = true;
                this.save();
            }
        } else {
            // Brand new user
            this.data.bonusGiven = true;
            this.save();
        }
        this.updateUI();
    },

    save: function() {
        localStorage.setItem('snakeLiteShop', JSON.stringify(this.data));
        this.updateUI();
    },

    buySkin: function(skinId) {
        const skin = this.skins.find(s => s.id === skinId);
        if (this.data.coins >= skin.price && !this.data.unlocked.includes(skinId)) {
            this.data.coins -= skin.price;
            this.data.unlocked.push(skinId);
            this.equipSkin(skinId); 
            this.save();
            return true;
        }
        return false;
    },

    equipSkin: function(skinId) {
        if (this.data.unlocked.includes(skinId)) {
            this.data.equipped = skinId;
            this.save();
            this.renderShop(); 
        }
    },

    getEquippedColor: function() {
        const skin = this.skins.find(s => s.id === this.data.equipped);
        return skin ? skin.color : '#4CAF50';
    },

    updateUI: function() {
        const els = document.querySelectorAll('#shopBalance, #coinDisplay, #finalCoins');
        els.forEach(el => { if(el) el.textContent = this.data.coins; });
    },

    renderShop: function() {
        const container = document.getElementById('skinsContainer');
        if(!container) return;
        container.innerHTML = '';

        this.skins.forEach(skin => {
            const isUnlocked = this.data.unlocked.includes(skin.id);
            const isEquipped = this.data.equipped === skin.id;
            
            const div = document.createElement('div');
            div.className = `skin-item ${isEquipped ? 'active' : ''} ${!isUnlocked ? 'locked' : ''}`;
            div.innerHTML = `
                <div style="width:30px; height:30px; background:${skin.color}; border-radius:50%; margin:0 auto;"></div>
                <div style="margin-top:5px; font-weight:bold;">${skin.name}</div>
                <div style="font-size:0.9rem;">${isUnlocked ? (isEquipped ? 'Equipped' : 'Select') : skin.price + ' 💰'}</div>
            `;
            
            div.onclick = () => {
                if (isUnlocked) {
                    this.equipSkin(skin.id);
                } else {
                    if(this.buySkin(skin.id)) {
                        alert("Skin Unlocked!");
                    } else {
                        alert("Not enough coins!");
                    }
                }
                this.renderShop();
            };
            container.appendChild(div);
        });
    }
};

Shop.init();