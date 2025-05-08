/**
 * 统计相关的工具函数
 */

/**
 * 计算发言间隔
 * @param {Array} messages 消息数组
 * @returns {number} 平均间隔（秒）
 */
function calculateAverageInterval(messages) {
    if (messages.length < 2) return 0;

    const timestamps = messages.map(msg => parseInt(msg.split(':')[0]) / 1000);
    let intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
}

/**
 * 计算发言分值
 * @param {number} averageInterval 平均间隔
 * @returns {number} 分值（0-1）
 */
function getSpeakingScore(averageInterval) {
    if (averageInterval <= 3) return 0.95;
    if (averageInterval >= 15) return 0.3;
    return 1 - (averageInterval - 2) * 0.05;
}

/**
 * 获取最近的消息
 * @param {Array} speechText 消息数组
 * @param {number} maxCount 最大消息数
 * @param {Array} key 要提取的键
 * @returns {Array} 处理后的消息数组
 */
function getLastMessages(speechText, maxCount = 30, key = ["username", "msg"]) {
    const messages = speechText || [];
    const startIndex = Math.max(0, messages.length - maxCount);
    return messages.slice(startIndex).map(item =>
        `${item[key[0]]}: ${item[key[1]]}`
    );
}

/**
 * 获取指定时间窗口内的消息
 * @param {Array} messages 消息数组
 * @param {number} timeWindow 时间窗口（毫秒）
 * @returns {Array} 时间窗口内的消息
 */
function getRoomMessagesInWindow(messages, timeWindow) {
    const now = Date.now();
    const cutoff = now - timeWindow;

    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].timestamp < cutoff) {
            return messages.slice(i + 1);
        }
    }
    return messages.slice();
}

/**
 * 计算房间长期发言频率
 * @param {Array} messages 消息数组
 * @returns {Object} 统计结果
 */
function calculateRoomLongTerm(messages) {
    if (messages.length < 2) return { frequency: messages.length, interval: 0 };

    const firstTimestamp = messages[0].timestamp;
    const lastTimestamp = messages[messages.length - 1].timestamp;
    const totalMin = (lastTimestamp - firstTimestamp) / 60000;

    return {
        frequency: totalMin > 0 ? messages.length / totalMin : messages.length,
        interval: (Date.now() - firstTimestamp) / messages.length / 1000
    };
}

/**
 * 计算5分钟平均发言频率
 * @param {Array} messages 消息数组
 * @returns {number} 平均频率
 */
function calculate5MinuteAverage(messages) {
    const fiveMinWindow = 5 * 60 * 1000;
    const fiveMinMessages = getRoomMessagesInWindow(messages, fiveMinWindow);

    if (fiveMinMessages.length === 0) return 0;

    const actualWindow = Math.min(
        Date.now() - fiveMinMessages[0].timestamp,
        fiveMinWindow
    );

    const minutes = Math.max(actualWindow / 60000, 1);
    return (fiveMinMessages.length / minutes).toFixed(1);
}

module.exports = {
    calculateAverageInterval,
    getSpeakingScore,
    getLastMessages,
    getRoomMessagesInWindow,
    calculateRoomLongTerm,
    calculate5MinuteAverage
}; 