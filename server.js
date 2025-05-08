/*
 * @Author: Gosoki s2122028@stu.musashino-u.ac.jp
 * @Date: 2024-11-13 18:21:45
 * @LastEditTime: 2025-05-08 17:33:14
 * Copyright (c) 2024 by Gosoki, All Rights Reserved. 
 */

// socket.emit: 向当前连接的客户端发送消息。
// io.emit: 向所有连接的客户端发送消息。
// socket.broadcast.emit: 向除当前连接的客户端外的所有客户端发送消息。
// socket.to(roomId).emit: 向房间内的所有客户端发送消息，但不包括当前连接的客户端。
// io.to(roomId).emit: 向房间内的所有客户端发送消息，包括当前连接的客户端。


//导入模块
const { sendToGPT, gpt2img, gpt2img_sd } = require('./utils/aifunc.js'); // 导入自定义的AI函数模块
const { calculateAverageInterval, getSpeakingScore, getLastMessages, 
        getRoomMessagesInWindow, calculateRoomLongTerm, calculate5MinuteAverage } = require('./utils/stats.js');

// ExpressとSocketIOをインポート
const express = require('express');
const expressapp = express();
const fs = require('fs');
const path = require('path');
const https = require('https');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

const { SocksProxyAgent } = require('socks-proxy-agent');
const proxyAgent = new SocksProxyAgent('socks5://127.0.0.1:10808');
// const fetch = require('node-fetch');

//web server定数
const PORT = 3005
const usePeerServer = true; // PeerServerを使用するかどうかのフラグ
const peerPORT = PORT + 1; // ポート番号を定義

const options = {
	key: fs.readFileSync("ssl/privkey.pem"), // SSL証明書の秘密鍵を読み込む
	cert: fs.readFileSync("ssl/fullchain.pem"), // SSL証明書を読み込む
};
const server = https.createServer(options, expressapp)


expressapp.use(express.static(
	path.join(__dirname, 'public')
)
);

//socket.io定数
const io = require('socket.io')(server, {
	allowEIO3: true,
});

//Peer server定数
if (usePeerServer) {
	const { PeerServer } = require("peer");
	const peerServer = PeerServer({
		port: peerPORT,
		path: "/peerjs",
		key: "peerjs",
		ssl: {
			key: options.key,
			cert: options.cert,
		},
	});
	peerServer.on("connection", (peerClient) => {
		console.log("new peerClient: " + peerClient.id); // 新しいPeerClientが接続したことをログに出力
	});
}

const folderPath = 'json/'; // 文件夹路径
const filename = `data_${Date.now()}.json`; // 生成文件名
const filePath = folderPath + filename
const speechText = { textdata: [] };

// 创建文件夹（如果不存在）
if (!fs.existsSync(folderPath)) {
	fs.mkdirSync(folderPath);
}

// 写入文件
fs.writeFileSync(filePath, JSON.stringify({ textdata: [] }, null, 2), 'utf8');

//定时器
var timer

//ai话题等待时长
const checkInterval = 20 * 1000; //1000=1SECOND

const roomTimers = {}; // 存储各房间的定时器
const STATS_INTERVAL = 1000; // 1秒更新一次

const userInfoMap = new Map();
const userPeerInfo = new Map();
const mainspace = "mainspace";

const MAX_MESSAGES_PER_ROOM = 1000; // 每个房间最大消息数
const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30分钟清理一次

// 配置日志系统
const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.json()
	),
	transports: [
		new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
		new winston.transports.File({ filename: 'logs/combined.log' })
	]
});

if (process.env.NODE_ENV !== 'production') {
	logger.add(new winston.transports.Console({
		format: winston.format.simple()
	}));
}

// 配置速率限制
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15分钟
	max: 100 // 限制每个IP 15分钟内最多100个请求
});

expressapp.use(limiter);

// 输入验证中间件
const validateInput = (req, res, next) => {
	const sanitizeString = (str) => {
		return str.replace(/[<>]/g, ''); // 移除潜在的HTML标签
	};

	if (req.body) {
		Object.keys(req.body).forEach(key => {
			if (typeof req.body[key] === 'string') {
				req.body[key] = sanitizeString(req.body[key]);
			}
		});
	}
	next();
};

expressapp.use(validateInput);

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
	logger.error('Error:', err);
	res.status(500).json({ error: '服务器内部错误' });
};

expressapp.use(errorHandler);

// 添加全局错误处理
process.on('uncaughtException', (err) => {
	console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('未处理的 Promise 拒绝:', reason);
});

// 定期清理机制
setInterval(() => {
	const now = Date.now();
	for (const roomId in speechText) {
		// 清理超过24小时的消息
		speechText[roomId] = speechText[roomId].filter(msg => 
			now - msg.timestamp < 24 * 60 * 60 * 1000
		);
		
		// 如果消息数量超过限制，只保留最新的消息
		if (speechText[roomId].length > MAX_MESSAGES_PER_ROOM) {
			speechText[roomId] = speechText[roomId].slice(-MAX_MESSAGES_PER_ROOM);
		}
	}
}, CLEANUP_INTERVAL);

//////Socket.IO FUNCTIONS Start//////
io.on('connection', (socket) => {
	logger.info(`New connection: ${socket.id}`);

	socket.join(mainspace)
	console.log("connection : ", socket.id);

	socket.on("seed_my_info_to_server", (msg) => {
		//console.log(msg)
		let user_id = msg[0];
		let user_color = msg[1];
		let user_name = msg[2];
		let user_position = msg[3];
		let user_msg = msg[4];
		let user_rotation = msg[5];
		socket.to(mainspace).emit('broadcast_user_info', [socket.id, user_id, user_color, user_name, user_position, user_msg, user_rotation]);
	});


	socket.on('join-room', (roomId, userId, userName) => {
		console.log("roomId, userId, userName=", roomId, userId, userName);
		userInfoMap.set(socket.id, [roomId, userId, userName]);// 将用户和关联的 roomId 存储在映射中
		userPeerInfo.set(userId, userName);
		socket.join(roomId)
		console.log(socket.rooms)
		console.log(userInfoMap)

		socket.to(roomId).emit('user-connected', userId, userName)
		io.emit('broadcast_usermap', Array.from(userPeerInfo.values()))

		socket.on('leave-room', () => {
			socket.leave(roomId);
			socket.to(mainspace).emit('user-disconnected', [socket.id, userId, userName])

			userInfoMap.delete(socket.id);// 从映射中删除用户
			console.log("logout:", userName, socket.id, userId)
			console.log(userInfoMap)

			//从字典中删除用户
			userPeerInfo.delete(userId);

			console.log(socket.rooms)
			io.emit('broadcast_usermap', Array.from(userPeerInfo.values()))
		})

		socket.on('disconnect', () => {
			logger.info(`Client disconnected: ${socket.id}`);
			socket.to(mainspace).emit('user-disconnected', [socket.id, userId, userName])
			userInfoMap.delete(socket.id);// 从映射中删除用户
			console.log("logout:", userName, socket.id, userId)
			console.log(userInfoMap)

			//从字典中删除用户
			userPeerInfo.delete(userId);
			io.emit('broadcast_usermap', Array.from(userPeerInfo.values()))
		})


		//定义AI连续画画相关
		const aidraw_count_needs = 100;
		const aidrawbackground_count_needs = 100;
		const aidrawCountMap = {}; //let aidraw_count = 0;
		const aidrawBackgroundCountMap = {}; //let aidrawbackground_count = 0;


		socket.on(`seed_my_speech_to_server_${roomId}`, async (msg) => {
			// 初始化对话文本对象
			if (!speechText[roomId]) {
				speechText[roomId] = [];
			}

			// 初始化计数器
			if (!(roomId in aidrawCountMap)) {
				aidrawCountMap[roomId] = 0;
			}
			if (!(roomId in aidrawBackgroundCountMap)) {
				aidrawBackgroundCountMap[roomId] = 0;
			}

			// 添加新消息到该房间的讲话文本对象
			speechText[roomId].push({
				userid: msg[0],
				username: msg[1],
				msg: msg[2],
				timestamp: Date.now(),
			});

			//写入json
			if (fs.existsSync(filePath)) {
				updateFileData(filePath, msg, roomId);
			}
			console.log(`${roomId}@u_[${msg[1]}]:${msg[2]}`)

			console.log(`[${roomId}] 启动统计定时器`);

			// 启动/重置房间定时器
			if (!roomTimers[roomId]) {
				startRoomStatsTimer(roomId);
				console.log(`[${roomId}] 启动统计定时器`);
			}


			last30SpeechText =getLastMessages(speechText[roomId], 10, ["timestamp", "msg"]);

			// 计算用户发言频率 发送透明度
			let speech_avg = calculateAverageInterval(last30SpeechText);
			let speech_rgba = getSpeakingScore(speech_avg);
			console.log(`平均发言间隔（秒）：${speech_avg}`);
			console.log(`输出值：${speech_rgba}`);
			io.emit('broadcast_room_rgba',[roomId,speech_rgba]);



			// const roomMessages = speechText[roomId] || [];

			// // 短期统计：最近1分钟
			// const SHORT_WINDOW = 60 * 1000; // 1分钟
			// const shortTermMessages = getRoomMessagesInWindow(roomMessages, SHORT_WINDOW);
			// const shortTermFrequency = shortTermMessages.length / (SHORT_WINDOW / 60000); // 转换为小时频率

			// // 长期统计：全时段
			// const longTermStats = calculateRoomLongTerm(roomMessages);

			// console.log(`[${roomId} 短期] 最近${SHORT_WINDOW/1000}秒消息数：${shortTermMessages.length} 条 (${shortTermFrequency.toFixed(1)}条/分钟)`);
			// console.log(`[${roomId} 长期] 总计消息：${roomMessages.length} 条 平均频率：${longTermStats.frequency.toFixed(1)}条/分钟 平均间隔：${longTermStats.interval.toFixed(1)}秒`);




			//自动ai图 发送图片
			if (aidrawCountMap[roomId] < aidraw_count_needs) {
				aidrawCountMap[roomId]++;
			} else {
				(async () => {
					last30SpeechText = getLastMessages(speechText[roomId], 30, ["username", "msg"]);
					try {
						// const aihint = await sendToGPT(last30SpeechText,"Draw_continue")
						const aihint = await gpt2img_sd(last30SpeechText, "Draw")

						// io.to(roomId).emit('broadcast_aihint', aihint);
						// io.to(roomId).emit('broadcast_aidraw_sd', aihint);
						io.emit('broadcast_room_aiimg', [roomId, aihint]);
						console.log("broadcast_aidraw_continue!")
					} catch (error) {
						console.error(error);
					}
				})()
				aidraw_count = 0;
			}

			//自动ai连续背景色 发送背景色
			if (aidrawBackgroundCountMap[roomId] < aidrawbackground_count_needs) {
				aidrawBackgroundCountMap[roomId]++;
			} else {
				(async () => {
					last30SpeechText = getLastMessages(speechText[roomId], 30, ["username", "msg"]);
					try {
						const aihint = await sendToGPT(last30SpeechText, "Draw_background_continue");
						// console.log(`server->[${userRoomId}@user]:${aihint}`);
						io.emit('broadcast_drawbackground', [roomId, aihint]);
						//io.to(userRoomId).emit('broadcast_aihint', aihint);
					} catch (error) {
						console.error(error);
					}
				})()
				aidrawbackground_count = 0;
			}

		});

		//单次ai总结
		socket.on('seed_hit_needs_to_server', (msg) => {
			//console.log(msg)
			last30SpeechText = getLastMessages(speechText[roomId], 30, ["username", "msg"]);

			console.log(last30SpeechText);
			(async () => {
				try {
					const aihint = await sendToGPT(last30SpeechText, "MainPoints");
					console.log(`server->[${roomId}@user]:${aihint}`);
					socket.emit('broadcast_aihint', aihint);
					//io.to(roomId).emit('broadcast_aihint', aihint);
				} catch (error) {
					console.error(error);
				}
			})()
		});

		//单次ai画画
		socket.on('seed_draw_needs_to_server', async (msg) => {
			//console.log(msg)
			last30SpeechText = getLastMessages(speechText[roomId], 30, ["username", "msg"]);
			// console.log(speechText)
			console.log(last30SpeechText);
			// (async () => {
			// try {
			// 	const aihint = await gpt2img(last30SpeechText,"Draw")
			// 	socket.emit('broadcast_aidraw', aihint);
			// } catch (error) {
			// 	console.error(error);
			// }
			// })()

			const asyncOperation1 = async () => {
				try {
					const aihint = await gpt2img(last30SpeechText, "Draw");
					socket.emit('broadcast_aidraw_dalle', aihint);
					return "OK";
				} catch (error) {
					console.error("Error in asyncOperation2:", error);
					throw error;
				}
			};
			const asyncOperation2 = async () => {
				try {
					const aihint = await gpt2img_sd(last30SpeechText, "Draw_sd");
					socket.emit('broadcast_aidraw_sd', aihint);
					return "OK";
				} catch (error) {
					console.error("Error in asyncOperation2:", error);
					throw error;
				}
			};
			const [result1, result2] = await Promise.all([
				asyncOperation1(),
				asyncOperation2()
			]);

		});


		socket.on('seed_drawbackground_needs_to_server', async (msg) => {
			//console.log(msg)
			last30SpeechText = getLastMessages(speechText[roomId], 30, ["username", "msg"]);
			// console.log(speechText)
			console.log(last30SpeechText);
			(async () => {
				try {
					const aihint = await sendToGPT(last30SpeechText, "Draw_background");
					// console.log(`server->[${userRoomId}@user]:${aihint}`);
					socket.emit('broadcast_drawbackground', aihint);
					//io.to(userRoomId).emit('broadcast_aihint', aihint);
				} catch (error) {
					console.error(error);
				}
			})()

		});

	})
});
//////Socket.IO FUNCTIONS End//////


//////Write Json ASYNC FUNCTIONS Start//////
async function updateFileData(filename, msg, roomid) {
	const maxRetries = 3;
	let retries = 0;

	while (retries < maxRetries) {
		try {
			const fileData = await fs.promises.readFile(filename, 'utf8');
			const jsonData = JSON.parse(fileData);
			
			if (!jsonData[roomid]) jsonData[roomid] = [];
			jsonData[roomid].push({
				userid: msg[0],
				username: msg[1],
				msg: msg[2],
				timestamp: Date.now(),
			});
			
			if (jsonData[roomid].length > MAX_MESSAGES_PER_ROOM) {
				jsonData[roomid] = jsonData[roomid].slice(-MAX_MESSAGES_PER_ROOM);
			}
			
			const updatedData = JSON.stringify(jsonData, null, 2);
			await fs.promises.writeFile(filename, updatedData, 'utf8');
			logger.info(`Data updated and saved @${filename} successfully.`);
			return;
		} catch (err) {
			retries++;
			logger.error(`Error updating file (attempt ${retries}/${maxRetries}):`, err);
			if (retries === maxRetries) {
				throw err;
			}
			await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // 指数退避
		}
	}
}
//////Write Json ASYNC FUNCTIONS End//////

function startRoomStatsTimer(roomId) {
	// 创建新定时器
	roomTimers[roomId] = setInterval(() => {
		const now = Date.now();

		const roomMessages = speechText[roomId] || [];

		// 短期统计（1分钟）
		// 获取最近1分钟内的消息
		const shortTermMessages = getRoomMessagesInWindow(roomMessages, 60000);
		// 计算1分钟内的消息数量
		const shortTerm = shortTermMessages.length;
		// 计算1分钟内的总字符数
		const shortCharCount = shortTermMessages.reduce((sum, m) => sum + (m.msg ? m.msg.length : 0), 0);

		// 中期统计（5分钟平均）
		// 获取最近5分钟内的消息
		const midTermMessages = getRoomMessagesInWindow(roomMessages, 5 * 60 * 1000);
		// 计算实际的时间窗口（不超过5分钟）
		const actualMidWindow = Math.min(now - (midTermMessages[0]?.timestamp || now), 5 * 60 * 1000);
		// 将时间窗口转换为分钟数（至少1分钟）
		const midTermMinutes = Math.max(actualMidWindow / 60000, 1);
		// 计算5分钟内的平均消息数
		const midTermAvg = calculate5MinuteAverage(roomMessages);
		// 计算5分钟内的总字符数
		const midCharCount = midTermMessages.reduce((sum, m) => sum + (m.msg ? m.msg.length : 0), 0);
		// 计算5分钟内的平均字符数（保留一位小数）
		const midCharAvg = (midCharCount / midTermMinutes).toFixed(1);

		// 长期统计
		// 
		const longTermStats = calculateRoomLongTerm(roomMessages);

		// 构造统计数据
		const stats = {
			roomId,
			timestamp: now,
			shortTerm: {
				messages: shortTerm,
				perMinute: shortTerm,
				charPerMinute: shortCharCount
			},
			midTerm: {
				windowMinutes: 5,
				averagePerMin: midTermAvg,
				charAveragePerMin: midCharAvg
			},
			longTerm: {
				total: roomMessages.length,
				avgPerMin: longTermStats.frequency.toFixed(1),
				avgInterval: longTermStats.interval.toFixed(1)
			}
		};

		// 广播给所有客户端
		io.to(roomId).emit('broadcast_room_stats', stats);

		// 优化后的日志输出
		console.log(JSON.stringify({
			room: roomId,
			time: new Date(now).toISOString(),
			short: `${shortTerm}/min`,
			shortChars: `${shortCharCount}/chars`,
			mid: `${midTermAvg}/min(5min avg)`,
			midChars: `${midCharAvg}/chars(5min avg)`,
			long: `${stats.longTerm.avgPerMin}/min(total)`,
			interval: `${stats.longTerm.avgInterval}sec`,
			total: roomMessages.length,
		}, null, 2));

		// 自动清理闲置房间（5分钟无消息）
		if (roomMessages.length > 0) {
			const lastMsgTime = roomMessages[roomMessages.length - 1].timestamp;
			if (Date.now() - lastMsgTime > 300000) { // 5分钟
				clearInterval(roomTimers[roomId]);
				delete roomTimers[roomId];
				speechText[roomId] = []; // 清空房间数据
				console.log(`[${roomId}] 房间因闲置停止统计`);
			}
		}
	}, STATS_INTERVAL);

	console.log(`[${roomId}] 启动统计定时器`);
}



server.listen(PORT, () => console.log(`Listening on port ${PORT}`))