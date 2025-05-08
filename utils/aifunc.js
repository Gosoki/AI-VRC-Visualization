const dotenv = require("dotenv"); // 環境変数を扱うdotenvモジュールをインポート
dotenv.config(); // 環境変数を.envファイルから読み込む
if (!process.env.OPENAI_APIKEY || !process.env.OPENAI_BASEPATH) {
	throw new Error("required environment variables."); // 必要な環境変数が設定されていない場合はエラーをスロー
}

//////Ai FUNCTIONS Start//////
//发送给gpt sendToGPT();
// const { Configuration, OpenAIApi } = require("openai");
// const configuration = new Configuration({
//     apiKey: process.env.OPENAI_APIKEY,
//     basePath: process.env.OPENAI_BASEPATH,
// 	httpAgent: proxyAgent,
// 	httpsAgent: proxyAgent
// });
// const openai = new OpenAIApi(configuration);

// import OpenAI from 'openai';
const { OpenAI } = require("openai");
const { rootCertificates } = require('tls');
const openai = new OpenAI({
	apiKey: process.env.OPENAI_APIKEY,
    // basePath: process.env.OPENAI_BASEPATH,
	// httpAgent: proxyAgent,
	// httpsAgent: proxyAgent
})


async function sendToGPT(speechText,mode) {
	switch (mode) {
		case "Topics": //话题
			try {
			const completion = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{"role": "system", 
					"content": "私と一緒にロールプレイをしてください。ロールプレイでは、言語モデルではなく、あなたのキャラクター設定で質問に答える必要があります。これが非常に重要です！"},
					{"role": "user", 
					"content": "あなたの設定は、雰囲気を判断することが得意な観察者です。ユーザー間の対話をシミュレートすることはしないでください！あなた自身を表現することもしないでください。あなたは観察者であり、ユーザーに話題を提案するだけで、'私'という言葉を使ったり、自分を観察者と呼んだりしないでください。これが非常に重要です！ユーザー間のチャットメッセージを受け取り、設定に基づいて会話を続けるための一言を返信するだけ、他の言葉はいらないです。これが非常に重要です！返信する際には、ユーザー名を提起しないでください！文脈によって会話を続ける方法がないと判断した場合、新しいトピックを提案します。"},
					{"role": "assistant", 
					"content": "了解しました。ユーザー間のチャットメッセージに基づいてトピックを提案したり、会話を続けるための一言を返信します。会話を進めるために、ユーザーが送信した会話を始めてください。私は会話を続けるための一言を返信します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.choices[0].message,completion.usage);
				return completion.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;

		case "MainPoints": //总结
			try {
			const completion = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{"role": "system",
					"content": "私が提供した設定に基づいて質問に答えるようにしてください。これが非常に重要です！"},
					{"role": "user",
					"content": "ユーザー間の対話をシミュレートすることをしないでください。あなたは観察者です。専門的なまとめ作成者としての役割は、私が提供した対話を簡潔！にまとめることです。返事は簡潔なまとめだけでいいです。"},
					{"role": "assistant",
					"content": " 了解しました。提供された設定に基づいて、簡潔にまとめられた回答を提供します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.choices[0].message,completion.usage);
				return completion.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;

		case "Draw_continue": //dalle画画 连续
			try {
				const completion = await openai.chat.completions.create({
				model: "gpt-4o-mini",	
				messages: [
					{"role": "system",
					"content": "私が提供した設定に基づいて質問に答えるようにしてください。これが非常に重要です！"},
					{"role": "user",
					"content": `我会给你一段用户间的对话,请你判断是否需要绘制一张图片来 用图片的形式去具象对话中的内容,
					如果需要生成一张图片,请用json的形式(字符串)返回yes or no 和对话中应该被dall-e-3绘画的英语prompt。如下{draw:"yes/no",prompt:"A cute cat"}"}.如果是no,在prompt处输出原因。`},
					{"role": "assistant",
					"content": " 了解しました。提供された設定に基づいて、簡潔にまとめられた回答を提供します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.choices[0].message,completion.usage);
				return completion.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;
		
		case "Draw": //dalle画画
			try {
				const completion = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{"role": "system",
					"content": "私が提供した設定に基づいて質問に答えるようにしてください。これが非常に重要です！"},
					{"role": "user",
					"content": `我会给你一段用户间的对话,
					针对对话的内容，而无需关注有多少用户参与在聊天，用图片的形式去具象对话中的内容,必须优先根据最后的几句对话提及的话题作为关键词(作为主题)，至于较早的对话内容：可适当舍弃与当前主题无关的内容。如果是相关的内容可适当作为补充关键词。
					需要生成一张图片,请用json的形式(字符串)返回draw:"yes"和对话中应该被dall-e-3绘画的英语prompt。如下例子{draw:"yes",prompt:"A cute cat flying in sky"}"}。`},
					{"role": "assistant",
					"content": " 了解しました。提供された設定に基づいて、jsonのみを回答します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.choices[0].message,completion.usage);
				return completion.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;

			case "Draw_sd": //SD画画
			try {
				const completion = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{"role": "system",
					"content": "私が提供した設定に基づいて質問に答えるようにしてください。これが非常に重要です！"},
					{"role": "user",
					"content": `我会给你一段用户间的对话,请你判断是否需要绘制一张图片来使得他们间的对话更加便于了解（对话内容中可以被图形表示的部分）,
					针对对话的内容，而无需关注有多少用户参与在聊天，用图片的形式去具象对话中的内容,
					尽可能地提取出对话中的关机词,生成对应的stable diffusion中绘画的英语prompt。
					需要生成一张图片,请用json的形式(字符串)返回draw:"yes"和对话中应该被stable diffusion中绘画的英语prompt。
					提取对话中的关键词,生成对应的prompt,2个人"2 people",3只猫"3 cats",雨天"rain"。
					如下{draw:"yes",prompt:"masterpiece, best quality,sun,2 cat"}"}。`},
					{"role": "assistant",
					"content": " 了解しました。提供された設定に基づいて、jsonのみを回答します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.choices[0].message,completion.usage);
				return completion.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;

			case "Draw_background_continue": //连续背景色
			try {
				const completion = await openai.chat.completions.create({
				model: "gpt-4o-mini",
				messages: [
					{"role": "system",
					"content": "私が提供した設定に基づいて質問に答えるようにしてください。これが非常に重要です！"},
					{"role": "user",
					"content": `我会给你一段用户间的对话,
					针对对话的内容，而无需关注有多少用户参与在聊天，按对话中的内容给我返回颜色代码, 根据话题的积极性与消极性，给与对应的代码颜色代码,如果消极给冷色调，积极给暖色调。不要给深红深蓝,偏温和的色调。
					如果是正常讨论，而且不含负面等消极词语，可适当根据聊天中的内容给出相关颜色代码。如果聊天内容中有冷色调的词语，则弃用，如果有暖色调的词语，则根据内容返回对应的颜色。可优先根据最后的几句对话来返回对应颜色。
					请优先根据对话中的内容返回颜色代码，如果你无法判断颜色，请返回：#d3d3d4 
					请只返回颜色代码，返回值参考如下: #f0f0f0`},
					{"role": "assistant",
					"content": " 了解しました。提供された設定に基づいて、#xxxxxxのみを回答します。"},
					{"role": "user", "content": "以下は対話内容:"+speechText + "."}
					],
				});
				console.log(speechText)
				console.log(completion.choices[0].message,completion.usage);
				return completion.choices[0].message.content
			} catch (error) {
			console.error('发送给 GPT时出错：', error);
			}
			break;
	}
}

// 调用 dalle 生成图像
async function dalleGenerateImage(prompt) {
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,  // 生成图像的数量
		response_format:"b64_json",
        size: "1024x1024",  // 图像的尺寸
    });
    const imageUrl = response.data[0].b64_json;
	return imageUrl
}

// 调用 sd 生成图像
async function sdGenerateImage(prompt) {
	const fetch = (await import('node-fetch')).default;
	console.log("XXXX")
	const url = 'http://turnserver.844448.xyz:3006/sdapi/v1/txt2img';  // 替换为您的 Stable Diffusion API 端点
	// const url = 'https://f6d90405eeb80aed2f.gradio.live/sdapi/v1/txt2img';  // 替换为您的 Stable Diffusion API 端点

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			// 'Authorization': `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			prompt: prompt,
			"negative_prompt": "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
			"seed": -1,
			"subseed": -1,
			"sampler_name": "DPM++ 2M",
			"steps": 27,
			"cfg_scale": 8,
			"denoising_strength": 0.35,
			"batch_count": 1,
			"batch_size": 1,
			"width": 512, 
			"height": 512,
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error("API request failed: ${errorText}");
	}
	const responseData = await response.json();
	// console.log(responseData.images[0])
	const imageBase64 = responseData.images[0];

	return imageBase64;
}

//调用GPT生成 dalle prompt
async function gpt2img(Text,mode){
    rawString = await sendToGPT(Text,mode)
    const jsonString = rawString
    .replace(/(\w+):/g, '"$1":')
    .replace(/:no/g, ':"no"')
    .replace(/:yes/g, ':"yes"');
    try {
        // 解析为 JSON 对象
        const jsonObject = JSON.parse(jsonString);
        console.log(jsonObject);
		// broadcast_aidraw_reason
		io.emit("broadcast_aidraw_reason",jsonObject)
        if (jsonObject["draw"]=="yes") return await dalleGenerateImage(jsonObject["prompt"])
    } catch (error) {
        console.error('Error parsing JSON string:', error);
    }
}

//调用GPT生成 sd prompt
async function gpt2img_sd(Text,mode){
    rawString = await sendToGPT(Text,mode)
	const match = rawString.match(/{.*}/); // 使用正则匹配大括号内的内容
	if (match) {
		const jsonString = match[0]
		.replace(/(\w+):/g, '"$1":')
		.replace(/:no/g, ':"no"')
		.replace(/:yes/g, ':"yes"');
		try {
			// 解析为 JSON 对象
			const jsonObject = JSON.parse(jsonString);
			console.log(jsonObject);
			// broadcast_aidraw_reason
			io.emit("broadcast_aidraw_reason",jsonObject)
			if (jsonObject["draw"]=="yes") return await sdGenerateImage(jsonObject["prompt"])
		} catch (error) {
			console.error('Error parsing JSON string:', error)
		}
	}
}
//////Ai FUNCTIONS End//////



//导出函数
module.exports = { 
	sendToGPT,
	dalleGenerateImage,
	sdGenerateImage,
	gpt2img,
	gpt2img_sd
};
