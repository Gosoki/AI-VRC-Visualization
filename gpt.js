/*
 * @Author: Gosoki Gosoki@github.com
 * @Date: 2024-07-16 17:09:00
 * @LastEditTime: 2024-07-16 17:26:46
 * Copyright (c) 2024 by Gosoki, All Rights Reserved. 
 */

const axios = require("axios");
const dotenv = require("dotenv"); 
const { SocksProxyAgent } = require('socks-proxy-agent');
const proxyAgent = new SocksProxyAgent('socks5://127.0.0.1:10808');

dotenv.config(); // 環境変数を.envファイルから読み込む
if (!process.env.OPENAI_APIKEY || !process.env.OPENAI_BASEPATH) {
	throw new Error("required environment variables."); // 必要な環境変数が設定されていない場合はエラーをスロー
}


text ="hot"

async function gpt(){
console.log("Text:", text);
try {
    const response = await axios.post(
    process.env.OPENAI_BASEPATH+"/chat/completions",
    {
        model: "gpt-3.5-turbo",
        messages: [
        {
            role: "system",
            content:
            "You are responsible for reading the author's sensibility from the given text and answering with #RRGGBB the colours that suit the mood.",
        },
        {
            role: "user",
            content: `Suggest a color based on this text: "${text}"`,
        },
        ],
    },
    {
        headers: {
        Authorization: `Bearer ${process.env.OPENAI_APIKEY}`,
        "Content-Type": "application/json",
        },
        httpsAgent: proxyAgent,
        httpAgent: proxyAgent
    }
    );

    const colorResponse = response.data.choices[0].message.content;
    console.log("Color Response:", colorResponse);

} catch (error) {
    console.error("Error:", error);
}
}


gpt()