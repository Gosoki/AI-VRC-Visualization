/*
 * @Author: Gosoki s2122028@stu.musashino-u.ac.jp
 * @Date: 2025-05-08 16:04:10
 * @LastEditTime: 2025-05-08 16:43:58
 * Copyright (c) 2025 by Gosoki, All Rights Reserved. 
 */
// ================ 客户端消息存储 ================
const userSpeechData = {
    messages: [], // 结构：{timestamp: number, text: string}
    stats: {
        shortTerm: 0,    // 最近1分钟消息数
        midTermAvg: 0,   // 5分钟平均/分钟
        longTerm: {      // 长期统计
            total: 0,
            avgPerMin: 0,
            lastHour: 0
        }
    }
};

// ================ 修改后的统计计算函数 ================
function calculateLocalStats() {
    const now = Date.now();
    const allMessages = userSpeechData.messages;

    // 短期统计（1分钟）
    const shortTerm = allMessages.filter(m => 
        now - m.timestamp < 60000
    ).length;

    // 中期统计（精确5分钟窗口）
    let midTermAvg = 0;
    const fiveMinCutoff = now - 300000; // 5分钟临界点
    
    // 使用二分查找优化性能
    let left = 0;
    let right = allMessages.length - 1;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (allMessages[mid].timestamp < fiveMinCutoff) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    const fiveMinMessages = allMessages.slice(left);
    
    if (fiveMinMessages.length > 0) {
        // 计算实际时间跨度（精确到秒）
        const oldestTimestamp = fiveMinMessages[0].timestamp;
        const actualDuration = Math.min(now - oldestTimestamp, 300000);
        const actualMinutes = Math.max(actualDuration / 60000, 0.016667); // 至少1秒
        
        // 计算精确平均值
        midTermAvg = fiveMinMessages.length / (actualMinutes > 5 ? 5 : actualMinutes);
    }

    // 长期统计（保持原逻辑）
    const total = allMessages.length;
    const firstTimestamp = allMessages[0]?.timestamp || now;
    const hours = (now - firstTimestamp) / 3600000;
    const avgPerMin = hours > 0 ? total / (hours * 60) : total;

    return {
        shortTerm,
        midTermAvg: Number(midTermAvg.toFixed(1)),
        longTerm: {
            total,
            avgPerMin: Number(avgPerMin.toFixed(1)),
            lastHour: calculateLastHourStats(allMessages, now)
        }
    };
}


// ================ 定时更新机制 ================
let statsInterval = null;

function startStatsUpdater() {
    if (!statsInterval) {
        statsInterval = setInterval(() => {
            updateLocalStats();
            updateUI();
        }, 1000); // 每秒更新

        // 清理过期数据（保留24小时）
        setInterval(() => {
            const cutoff = Date.now() - 86400000;
            userSpeechData.messages = userSpeechData.messages.filter(
                m => m.timestamp > cutoff
            );
        }, 60000);
    }
}

// ================ 可视化更新 ================
function updateUI() {
    // 示例：更新仪表盘
    document.getElementById('short-term').textContent = 
        userSpeechData.stats.shortTerm;
    
    document.getElementById('mid-term').textContent = 
        userSpeechData.stats.midTermAvg;
    
    document.getElementById('long-term').textContent = 
        userSpeechData.stats.longTerm.avgPerMin;
}

// ================ 辅助函数 ================
function calculateLastHourStats(messages, now) {
    const hourAgo = now - 3600000;
    return messages.filter(m => 
        m.timestamp > hourAgo
    ).length;
}

function updateLocalStats() {
    userSpeechData.stats = calculateLocalStats();
}

// 初始化
startStatsUpdater();