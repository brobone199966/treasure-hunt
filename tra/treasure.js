// ================= 模拟宝藏地图API =================
class TreasureMap {
    static getInitialClue() { return new Promise(r => setTimeout(() => r("在古老的图书馆里找到了第一个线索..."), isReplaying ? 0 : 1000)); }
    static decodeAncientScript(clue) { return new Promise((r, j) => setTimeout(() => !clue ? j("没有线索!") : r("解码成功!宝藏在一座古老的神庙中..."), isReplaying ? 0 : 1500)); }
    static openTreasureBox() { return new Promise(r => setTimeout(() => r("恭喜!你找到了传说中的宝藏!"), isReplaying ? 0 : 1000)); }
}

// ================= 地图与剧情数据 =================
const MAP_NODES = {
    start: { x: 15, y: 80, icon: '🏛️', label: '古老图书馆', next: ['forest', 'cave'] },
    forest: { x: 40, y: 30, icon: '🌲', label: '迷雾森林', next: ['temple_left'] },
    cave: { x: 40, y: 80, icon: '🕳️', label: '废弃矿洞', next: ['temple_right'] },
    temple_left: { x: 70, y: 30, icon: '🚪', label: '神庙左门', next: ['treasure'] },
    temple_right: { x: 70, y: 80, icon: '🚪', label: '神庙右门', next: ['treasure'] },
    treasure: { x: 90, y: 50, icon: '💎', label: '宝藏祭坛', next: [] }
};

const MAP_EDGES = [
    ['start', 'forest'], ['start', 'cave'],
    ['forest', 'temple_left'], ['cave', 'temple_right'],
    ['temple_left', 'treasure'], ['temple_right', 'treasure']
];

// ================= 全局状态 =================
let playerHp = 100;
let progress = 0;
let historyStack = [];     
let choiceHistory = [];    
let isReplaying = false;   
let currentNodeId = 'start'; 
let visitedNodes = ['start'];
let allowedMapNodes = []; 
let mapClickResolver = null;

// ================= 工具函数 =================
function wait(ms) { if (isReplaying) return Promise.resolve(); return new Promise(r => setTimeout(r, ms)); }

function log(msg, type = '') {
    if (isReplaying) return; 
    const logEl = document.getElementById('log');
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    entry.textContent = "➤ " + msg;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
}

function updateHp(value) {
    if (isReplaying) return; 
    playerHp += value;
    if (playerHp < 0) playerHp = 0;
    document.getElementById('hp-text').textContent = playerHp;
    document.getElementById('hp-bar').style.width = playerHp + '%';
    const hero = document.getElementById('hero');
    if (value < 0) { hero.classList.add('shake'); setTimeout(() => hero.classList.remove('shake'), 400); }
    if (playerHp <= 0) { 
        hero.textContent = '💀'; 
        log("💀 体力耗尽，任务失败！", "error"); 
        throw new Error("体力耗尽"); 
    }
}

function setProgress(value) {
    if (isReplaying) return;
    progress = value;
    document.getElementById('progress-bar').style.width = progress + '%';
    document.getElementById('progress-text').textContent = progress;
}

// ================= 地图渲染与交互 =================
function initMap() {
    const wrapper = document.getElementById('map-wrapper');
    const svg = document.getElementById('map-svg');
    wrapper.querySelectorAll('.map-node').forEach(n => n.remove());
    svg.innerHTML = '';

    MAP_EDGES.forEach(([from, to]) => {
        const f = MAP_NODES[from], t = MAP_NODES[to];
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', f.x + '%'); line.setAttribute('y1', f.y + '%');
        line.setAttribute('x2', t.x + '%'); line.setAttribute('y2', t.y + '%');
        line.setAttribute('class', 'path-line');
        line.dataset.from = from; line.dataset.to = to;
        svg.appendChild(line);
    });

    Object.keys(MAP_NODES).forEach(id => {
        const node = MAP_NODES[id];
        const el = document.createElement('div');
        el.className = 'map-node';
        el.id = 'node-' + id;
        el.style.left = node.x + '%';
        el.style.top = node.y + '%';
        el.innerHTML = `<div class="icon">${node.icon}</div><div class="label">${node.label}</div>`;
        
        el.onclick = () => {
            if (el.classList.contains('active') && mapClickResolver) {
                moveToNode(id, true); 
            }
        };
        wrapper.appendChild(el);
    });
}

function updateMapState() {
    document.querySelectorAll('.map-node').forEach(n => n.className = 'map-node');
    document.querySelectorAll('.path-line').forEach(l => l.className = 'path-line');

    visitedNodes.forEach(id => {
        const el = document.getElementById('node-' + id);
        if (el) el.classList.add('visited');
    });
    const currEl = document.getElementById('node-' + currentNodeId);
    if (currEl) currEl.classList.add('current');

    if (!isReplaying && allowedMapNodes.length > 0) {
        allowedMapNodes.forEach(id => {
            const el = document.getElementById('node-' + id);
            if (el) el.classList.add('active');
            document.querySelectorAll('.path-line').forEach(l => {
                if (l.dataset.from === currentNodeId && l.dataset.to === id) l.classList.add('active');
            });
        });
    }

    const pos = MAP_NODES[currentNodeId];
    const hero = document.getElementById('hero');
    if (pos && hero) {
        hero.style.left = pos.x + '%';
        hero.style.top = pos.y + '%';
        hero.textContent = '🧑‍🚀'; // 强制恢复为常态图标
    }
}

async function moveToNode(nodeId, isManualClick = false) {
    if (isManualClick) {
        const resolve = mapClickResolver;
        mapClickResolver = null;
        allowedMapNodes = [];

        historyStack.push({ hp: playerHp, progress: progress, nodeId: currentNodeId, visited: [...visitedNodes], logHTML: document.getElementById('log').innerHTML });
        
        currentNodeId = nodeId;
        if (!visitedNodes.includes(nodeId)) visitedNodes.push(nodeId);
        log(`🚶 你决定前往【${MAP_NODES[nodeId].label}】...`, "info");
        choiceHistory.push(nodeId);
        updateMapState();
        resolve(nodeId);
    } else {
        currentNodeId = nodeId;
        if (!visitedNodes.includes(nodeId)) visitedNodes.push(nodeId);
        updateMapState();
    }
}

function waitForMapClick(allowed) {
    return new Promise(resolve => {
        if (isReplaying) {
            const nextNode = choiceHistory.shift();
            if (nextNode) {
                moveToNode(nextNode, false).then(resolve);
            } else {
                resolve();
            }
            return;
        }
        allowedMapNodes = allowed;
        mapClickResolver = resolve;
        updateMapState();
    });
}

function askPlayer(question, options, isSavePoint = true) {
    return new Promise(resolve => {
        if (isReplaying && choiceHistory.length > 0) {
            const choice = choiceHistory.shift();
            resolve(choice);
            return;
        }

        isReplaying = false; 
        log("🤔 " + question, "info");
        
        if (isSavePoint) {
            // 记录快照，同时记录进度
            historyStack.push({ 
                hp: playerHp, 
                progress: progress, 
                nodeId: currentNodeId, 
                visited: [...visitedNodes], 
                logHTML: document.getElementById('log').innerHTML 
            });
        }
        
        const interactionArea = document.getElementById('interaction-area');
        interactionArea.innerHTML = ''; 
        
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-choice';
            btn.textContent = opt.text;
            btn.onclick = () => {
                interactionArea.innerHTML = ''; 
                log("👉 你选择了：" + opt.text, "info");
                choiceHistory.push(opt.value); 
                resolve(opt.value);
            };
            interactionArea.appendChild(btn);
        });
    });
}

function showEndButtons() {
    const interactionArea = document.getElementById('interaction-area');
    interactionArea.innerHTML = ''; 
    const restartBtn = document.createElement('button');
    restartBtn.className = 'btn';
    restartBtn.textContent = '🔄 重新开始';
    restartBtn.onclick = () => startGame(false);
    interactionArea.appendChild(restartBtn);

    if (historyStack.length > 0) {
        const undoBtn = document.createElement('button');
        undoBtn.className = 'btn btn-choice';
        undoBtn.textContent = '↩️ 反悔一步';
        undoBtn.onclick = () => {
            // 终极回溯：弹出上一个存档
            const prevState = historyStack.pop();
            playerHp = prevState.hp;
            progress = prevState.progress; // 恢复进度条
            currentNodeId = prevState.nodeId;
            visitedNodes = prevState.visited;
            
            // 恢复 UI
            document.getElementById('hp-text').textContent = playerHp;
            document.getElementById('hp-bar').style.width = playerHp + '%';
            document.getElementById('progress-bar').style.width = progress + '%';
            document.getElementById('progress-text').textContent = progress;
            document.getElementById('log').innerHTML = prevState.logHTML;
            document.getElementById('hero').textContent = '🧑‍🚀';
            
            if (choiceHistory.length > 0) choiceHistory.pop(); 
            
            // 重新开始重放逻辑
            startGame(true);
        };
        interactionArea.appendChild(undoBtn);
    }
}

// ================= 主流程 =================
async function startGame(isUndoFlag = false) {
    isReplaying = isUndoFlag;
    initMap(); 

    if (!isReplaying) {
        document.getElementById('log').innerHTML = '';
        playerHp = 100; progress = 0; 
        currentNodeId = 'start'; visitedNodes = ['start'];
        historyStack = []; choiceHistory = [];
        allowedMapNodes = [];
        mapClickResolver = null;
        
        document.getElementById('hp-text').textContent = playerHp;
        document.getElementById('hp-bar').style.width = playerHp + '%';
        setProgress(0);
        document.getElementById('hero').textContent = '🧑‍🚀';
    } else {
        // 反悔时也同步一次UI，保证不闪烁
        document.getElementById('hp-text').textContent = playerHp;
        document.getElementById('hp-bar').style.width = playerHp + '%';
        document.getElementById('progress-bar').style.width = progress + '%';
        document.getElementById('progress-text').textContent = progress;
        document.getElementById('hero').textContent = '🧑‍🚀';
    }

    updateMapState(); 

    try {
        // ======== 节点：古老图书馆 ========
        if (currentNodeId === 'start') {
            if (!isReplaying) {
                await TreasureMap.getInitialClue();
                log("在古老的图书馆里找到了第一个线索...");
                setProgress(15);
                await wait(1000);
                log("🗺️ 请在右侧地图上点击你要前往的地点。", "info");
            }
            await waitForMapClick(['forest', 'cave']);
        }

        // ======== 节点：迷雾森林 ========
        if (currentNodeId === 'forest') {
            if (!isReplaying) {
                setProgress(30);
                log("🌲 你走进了迷雾森林，遇到了一个神秘精灵...");
                await wait(1000);
            }
            
            const choice = await askPlayer("精灵说可以帮你，但需要代价：", [
                { text: "A. 支付10体力换取线索", value: "pay" },
                { text: "B. 拒绝并自己寻找", value: "reject" }
            ]);
            
            if (!isReplaying) {
                if (choice === 'pay') { updateHp(-10); log("🔮 精灵指引了你一条明路。", "success"); }
                else { updateHp(-20); log("🤯 你在森林里迷路了，损失体力。", "error"); }
                log("🗺️ 请在右侧地图上点击前往神庙左门。", "info");
            }
            await waitForMapClick(['temple_left']);
        }

        // ======== 节点：废弃矿洞 ========
        if (currentNodeId === 'cave') {
            if (!isReplaying) {
                setProgress(30);
                log("🕳️ 你进入废弃矿洞，阴风阵阵...");
                await wait(1000);
            }
            
            const choice = await askPlayer("你发现了一条暗道：", [
                { text: "A. 探索暗道 (可能遇险)", value: "explore" },
                { text: "B. 快速通过 (损失体力)", value: "rush" }
            ]);
            
            if (!isReplaying) {
                if (choice === 'explore') {
                    if (Math.random() < 0.5) { updateHp(-30); log("💥 暗道塌方，你被砸伤了！", "error"); }
                    else { log("💎 意外发现了一些补给！", "success"); playerHp += 10; updateHp(0); }
                } else {
                    updateHp(-15); log("🏃 你快速通过，消耗了体力。", "info");
                }
                log("🗺️ 请在右侧地图上点击前往神庙右门。", "info");
            }
            await waitForMapClick(['temple_right']);
        }

        // ======== 节点：神庙左门 ========
        if (currentNodeId === 'temple_left') {
            if (!isReplaying) {
                setProgress(60);
                log("🚪 你来到了神庙左门，门上有一个谜题...");
                await wait(1000);
            }
            
            const choice = await askPlayer("你要如何应对？", [
                { text: "A. 解答谜题 (消耗10体力)", value: "solve" },
                { text: "B. 暴力破门 (消耗30体力)", value: "break" }
            ]);
            
            if (!isReplaying) {
                if (choice === 'solve') { updateHp(-10); log("✅ 谜题解开，大门缓缓打开。", "success"); }
                else { updateHp(-30); log("💥 门被撞开，但你受了伤。", "error"); }
                log("🗺️ 请在右侧地图上点击前往宝藏祭坛。", "info");
            }
            await waitForMapClick(['treasure']);
        }

        // ======== 节点：神庙右门 ========
        if (currentNodeId === 'temple_right') {
            if (!isReplaying) {
                setProgress(60);
                log("🚪 你来到了神庙右门，守卫在此巡逻...");
                await wait(1000);
            }
            
            const fightChoice = await askPlayer("守卫发现了你，你要怎么做？", [
                { text: "⚔️ 勇敢战斗 (消耗20体力，70%胜率)", value: "fight" },
                { text: "🏃 尝试逃跑 (消耗10体力)", value: "run" }
            ]);

            if (!isReplaying) {
                if (fightChoice === 'fight') {
                    updateHp(-20);
                    await wait(1000);
                    let fightWin = Math.random() < 0.7;
                    if (fightWin) { log("你成功击败了守卫！", "success"); }
                    else { updateHp(-30); log("你不敌守卫，受了重伤！", "error"); }
                } else {
                    updateHp(-10); log("你转身就跑，成功甩掉了守卫。", "success");
                }
                log("🗺️ 请在右侧地图上点击前往宝藏祭坛。", "info");
            }
            await waitForMapClick(['treasure']);
        }

        // ======== 节点：宝藏祭坛 ========
        if (currentNodeId === 'treasure') {
            if (!isReplaying) {
                setProgress(85);
                log("💎 你来到了宝藏祭坛，一个神秘的箱子出现在眼前...");
                await wait(1000);
            }

            let isBoxOpen = false;
            while (!isBoxOpen) {
                const openChoice = await askPlayer("宝箱上有一个密码锁，请输入密码：", [
                    { text: "尝试输入 1234", value: "1234" },
                    { text: "尝试输入 8888", value: "8888" }
                ], false); 

                if (openChoice === "1234") {
                    isBoxOpen = true;
                    if (!isReplaying) {
                        setProgress(100);
                        const treasure = await TreasureMap.openTreasureBox();
                        log(treasure, "success");
                        document.getElementById('hero').textContent = '💎';
                        log("🎉 寻宝任务圆满完成！", "success");
                    }
                    showEndButtons(); 
                } else {
                    if (!isReplaying) {
                        updateHp(-30); 
                        log("❌ 密码错误，触发陷阱！损失30体力。", "error");
                        await wait(1500); 
                        log("调整状态，再次尝试输入密码...", "info");
                    }
                }
            }
        }

    } catch (error) {
        if (!isReplaying) {
            log("任务失败: " + error, "error");
            showEndButtons(); 
        }
    }
}

window.startGame = startGame;