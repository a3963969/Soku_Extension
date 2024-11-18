let cachedToken = null;
let tokenExpireTime = 0;
// 在background.js中添加
let validTokens = {};

import config from './config.js';


class AnthropicService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }

  async getCompletion(prompt) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: prompt
          }],
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API 请求失败: ${response.status} - ${errorData.error?.message || '未知错误'}`);
      }

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Anthropic API 调用错误:', error);
      throw error;
    }
  }
}


// 获取 access token
async function getAccessToken() {
  const API_KEY = config.BAIDU_API_KEY;
  const SECRET_KEY = config.BAIDU_SECRET_KEY;

  if (cachedToken && Date.now() < tokenExpireTime) {
	console.log('Getting access token',cachedToken); // 调试信息
    return cachedToken;
  }

  const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`;
  
  try {
    const response = await fetch(tokenUrl);
    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpireTime = Date.now() + (data.expires_in * 1000) - 60000; // 提前1分钟过期
    console.log('Access token obtained successfully');
    return cachedToken;
  } catch (error) {
    console.error('Error fetching access token:', error);
    throw error;
  }

}

// 图片搜索函数
async function searchImage(imageUrl, retries = 3) {
  // 将 .webp 后缀替换为 .jpg
  imageUrl = imageUrl.replace(/\.webp($|\?)/, '.jpg$1');

  console.log('searchImage获取到完整URL:');
  console.log('%c' + imageUrl, 'word-wrap: break-word; white-space: pre-wrap;');
  
  const API_URL = 'https://aip.baidubce.com/rest/2.0/image-classify/v1/realtime_search/product/search';

  for (let i = 0; i < retries; i++) {
    try {
      const accessToken = await getAccessToken();
      const urlWithToken = `${API_URL}?access_token=${accessToken}`;

      const formData = new FormData();
      formData.append('url', imageUrl);

      const response = await fetch(urlWithToken, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.error_code) {
        throw new Error(`API error: ${result.error_msg}`);
      }

      return result;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// 修改handleDownload函数
async function handleDownload(request, sender) {
  console.log('处理下载请求:', request);
  
  try {
    // 清理文件名
    let cleanFilename = sanitizeFilename(request.filename);
    console.log('清理后的文件名:', cleanFilename);

    // 转换图片格式
    console.log('开始转换图片格式');
    const jpgBlob = await convertImageToJpg(request.url);
    
    // 下载图片
    console.log('开始下载转换后的图片');
    const downloadId = await downloadBlob(jpgBlob, cleanFilename);
    
    console.log('下载成功，ID:', downloadId);
    return { success: true, downloadId: downloadId, message: '下载成功' };
  } catch (error) {
    console.error('下载失败:', error);
    return { success: false, error: error.message };
  }
}

function sanitizeFilename(filename) {
  let clean = filename.replace(/[<>:"/\\|?*]+/g, '_');
  if (!clean.toLowerCase().endsWith('.jpg')) {
    clean = clean.replace(/\.[^/.]+$/, "") + '.jpg';
  }
  return clean;
}

async function convertImageToJpg(url) {
  // 获取图片数据
  //url = url.replace(/_wk_shein.*?(?=\.)/, '');
  url = url.replace(/_wk[^.]+(?=\.\w{3,4})/, '');
  console.log('清理后的图片链接是:', url);
  const response = await fetch(url);
  const blob = await response.blob();

  // 创建一个离屏canvas
  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext('2d');

  // 创建图片对象
  const img = await createImageBitmap(blob);

  // 设置canvas尺寸
  canvas.width = img.width;
  canvas.height = img.height;

  // 在canvas上绘制图片
  ctx.drawImage(img, 0, 0);

  // 将canvas内容转换为JPG blob
  return await canvas.convertToBlob({type: 'image/jpeg', quality: 0.8});
}

function downloadBlob(blob, filename) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = function() {
      chrome.downloads.download({
        url: reader.result,
        filename: filename,
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function uploadImageToBaidu(data) {
  const accessToken = await getAccessToken();
  const url = `https://aip.baidubce.com/rest/2.0/image-classify/v1/realtime_search/product/add?access_token=${accessToken}`;
  
  console.log('Sending request to Baidu API'); // 调试信息
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(data)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// 合并所有的消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background收到消息:', request);
    
    switch (request.action) {
      case 'getImageSearchResult':
        searchImage(request.url)
            .then(result => {
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'imageSearchResult',
                    url: request.url,
                    result: result
                });
            })
            .catch(error => {
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'imageSearchError',
                    url: request.url,
                    error: error.message
                });
            });
        return true; 

        case 'uploadImage':
            console.log('Uploading image to Baidu');
            uploadImageToBaidu(request.data)
                .then(data => {
                    console.log('Upload successful', data);
                    sendResponse({success: true, data: data});
                })
                .catch(error => {
                    console.error('Upload failed', error);
                    sendResponse({success: false, error: error.toString()});
                });
            return true;

        case 'downloadImage':
            console.log('开始处理下载请求');
            handleDownload(request, sender)
                .then(result => {
                    console.log('处理结果:', result);
                    sendResponse(result);
                })
                .catch(error => {
                    console.error('下载处理错误:', error);
                    sendResponse({success: false, error: error.message});
                });
            return true;

        case 'downloadZip':
            chrome.downloads.download({
                url: request.url,
                filename: request.filename,
                saveAs: true
            }, (downloadId) => {
                URL.revokeObjectURL(request.url);
            });
            return true;

        case 'openAmazonStyleSnap':
            chrome.tabs.create({ url: 'https://www.amazon.com/stylesnap' }, (tab) => {
                console.log('创建了新的Amazon StyleSnap标签页，ID:', tab.id);
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === tab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'simulateStyleSnap',
                            imageDataUrl: request.imageDataUrl
                        });
                        chrome.tabs.executeScript(tab.id, {file: 'amazonContentScript.js'});
                    }
                });
            });
            return true;

        case 'getTokens':
            sendResponse(validTokens);
            return true;

        case 'copyToClipboard':
            const textArea = document.createElement('textarea');
            textArea.value = request.text;
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                sendResponse({ success: true });
            } catch (err) {
                document.body.removeChild(textArea);
                sendResponse({ success: false, error: err.message });
            }
            return true;

        case 'fetchImage':
            console.log('开始处理fetchImage请求');
            fetch(request.url)
                .then(response => {
                    console.log('fetchImage请求响应:', response);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.blob();
                })
                .then(blob => {
                    console.log('fetchImage请求响应blob:', blob);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        sendResponse({ 
                            success: true,
                            data: reader.result 
                        });
                    };
                    reader.onerror = () => {
                        sendResponse({ 
                            success: false,
                            error: 'Failed to read blob',
                            details: reader.error
                        });
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(error => {
                    console.error('Error in background fetch:', error);
                    sendResponse({ 
                        success: false,
                        error: error.message,
                        details: error.stack
                    });
                });
            return true;
    }
});

// 保持其他事件监听器
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === "install") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("help.html")
        });
    }
});

chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
        if (details.url.includes('shein.com')) {
            const headers = details.requestHeaders;
            headers.forEach(header => {
                switch(header.name.toLowerCase()) {
                    case 'anti-in':
                        validTokens.antiIn = header.value;
                        break;
                    case 'armortoken':
                        validTokens.armorToken = header.value;
                        break;
                    case 'x-gw-auth':
                        validTokens.gwAuth = header.value;
                        break;
                    case 'smdeviceid':
                        validTokens.smdeviceid = header.value;
                        break;
                }
            });
        }
        return {requestHeaders: details.requestHeaders};
    },
    {urls: ["*://*.shein.com/*"]},
    ["requestHeaders"]
);