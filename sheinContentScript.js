// 添加更多的调试信息
console.log('开始加载 SOKU 脚本...');

// 在文件最开始添加token相关代码
window._validTokens = {};

// 拦截器代码
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
const originalFetch = window.fetch;

// 存储搜索结果
const searchResults = new Map();

// 添加新的按钮到指定的产品卡片，显示图片地址并进行图片搜索
function addHelperCard() {
  const productCards = document.querySelectorAll('.S-product-card__img-container:not([data-soku-ai-processed])');
		
	for (const card of productCards) {
			const imgContainer = card.querySelector('.crop-image-container');
			if (imgContainer) {
			const imgContainerimg = imgContainer.querySelector('.crop-image-container__img');
			if (imgContainerimg) {
				addButtonToCard(card, imgContainerimg);
				card.setAttribute('data-soku-ai-processed', 'true');
			}  
			} 
		}
    const productMain = document.querySelectorAll('.product-intro-zoom__item');
	for (const mainproduct of productMain) {
			const imgContainerimg = mainproduct.querySelector('.crop-image-container__img');
				if (imgContainerimg) {
					addButtonToCard(mainproduct, imgContainerimg);
				}
			mainproduct.setAttribute('data-soku-ai-processed', 'true');
		}
	const buyerShows = document.querySelectorAll('.s-swiper-slide customerreviews-details__image-slide-item');
	console.log('buyerShows:', buyerShows);
	for (const Show of buyerShows) {
		console.log('buyerShows:', buyerShows);
		const imgContainerimg = Show.querySelector('img');
			if (imgContainerimg) {
				addButtonToCard(Show, imgElement);
			}
			Show.setAttribute('data-soku-ai-processed', 'true');
    }
}


function addButtonToCard(card, imgElement) {
  // 搜索相似按钮
  const searchButton = document.createElement('button');
  searchButton.className = 'soku-ai-helper-button search-button';
  searchButton.textContent = '搜索相似';
  searchButton.style = `
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1001;
    padding: 5px 10px;
    background-color: rgba(76, 175, 80, 0.8);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  
  // 创建1688和AMZ按钮的容器
  const extraButtonsContainer = document.createElement('div');
  extraButtonsContainer.style = `
    position: absolute;
    top: 40px;
    right: 10px;
    z-index: 1001;
    display: flex;
    gap: 5px;
  `;

  // 1688按钮
  const button1688 = createExtraButton('1688', 'https://s.1688.com/youyuan/index.htm?imageAddress=');
  
  // AMZ按钮
  const buttonAMZ = createExtraButton('AMZ', 'https://www.amazon.com/stylesnap?q=');

  extraButtonsContainer.appendChild(button1688);
  extraButtonsContainer.appendChild(buttonAMZ);

  // 下载主图按钮
  const downloadButton = document.createElement('button');
  downloadButton.className = 'soku-ai-helper-button download-button';
  downloadButton.textContent = '下载主图';
  downloadButton.style = `
    position: absolute;
    bottom: 10px;
    right: 10px;
    z-index: 1001;
    padding: 5px 10px;
    background-color: rgba(33, 150, 243, 0.8);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  
  // 添加搜索相似按钮的点击事件
  searchButton.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 获取按钮的父元素
    const cardContainer = searchButton.closest('.S-product-card__img-container');
    const productContainer = searchButton.closest('.product-intro-zoom__item');
    let cropImageContainer;

    if (cardContainer) {
      cropImageContainer = cardContainer.querySelector('.crop-image-container');
    } else if (productContainer) {
      cropImageContainer = productContainer.querySelector('.crop-image-container');
    }

    if (cropImageContainer) {
      // 在 crop-image-container 中查找 img 元素
      const imgElement = cropImageContainer.querySelector('img');
      
      if (imgElement) {
        // 尝试获取完整图片URL
        const fullImageUrl = imgElement.src || imgElement.getAttribute('data-src');
        
        if (fullImageUrl && !fullImageUrl.includes('...')) {
          console.log('获取到完整URL:', fullImageUrl);
          chrome.runtime.sendMessage({action: 'getImageSearchResult', url: fullImageUrl});
          searchButton.textContent = '搜索中...';
          searchButton.style.backgroundColor = 'rgba(255, 165, 0, 0.8)';
        } else {
          console.error('无法获取完整URL:', fullImageUrl);
          searchButton.textContent = '获取URL失败';
          searchButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        }
      } else {
        console.error('未找到图片元素');
        searchButton.textContent = '未找到图片';
        searchButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
      }
    } else {
      console.error('未找到 crop-image-container');
      searchButton.textContent = '未找到图片容器';
      searchButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    }
  };
  
  // 添加下载主图按钮的点击事件
  downloadButton.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 获取图片URL
    const imgUrl = imgElement.src || imgElement.getAttribute('data-src');
	const imgAlt = imgElement.alt || 'shein_image';
    
    if (imgUrl) {
      // 使用 chrome.downloads API 下载图片。
      chrome.runtime.sendMessage({
        action: 'downloadImage',
        url: imgUrl,
		filename: `${imgAlt}.jpg`
      }, (response) => {
        if (response && response.success) {
          console.log('下载成功:', response.success);
          downloadButton.textContent = '下载成功';
          downloadButton.style.backgroundColor = 'rgba(76, 175, 80, 0.8)'; // 绿色
        } else {
          downloadButton.textContent = '下载失败';
          downloadButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)'; // 红色
        }
        // 3秒后恢复按钮原状
        setTimeout(() => {
          downloadButton.textContent = '下载主图';
          downloadButton.style.backgroundColor = 'rgba(33, 150, 243, 0.8)'; // 蓝色
        }, 3000);
      });
    } else {
      console.error('无法获取图片URL');
      downloadButton.textContent = '下载失败';
      downloadButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
    }
  };
  
  card.style.position = 'relative';
  card.prepend(searchButton);
  card.appendChild(extraButtonsContainer);
  card.appendChild(downloadButton);
}

// 创建额外按辅助函数
function createExtraButton(text, baseUrl) {
  const button = document.createElement('button');
  button.textContent = text;
  button.style = `
    padding: 3px 6px;
    background-color: rgba(33, 150, 243, 0.8);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 10px;
  `;
  
  button.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const imgElement = e.target.closest('.S-product-card__img-container, .product-intro-zoom__item').querySelector('.crop-image-container__img');
    if (imgElement) {
      const imgUrl = imgElement.src || imgElement.getAttribute('data-src');
      if (imgUrl) {
        if (text === '1688') {
          const stylesnap_url = `https://s.1688.com/youyuan/index.htm?imageAddress=${encodeURIComponent(imgUrl)}`;
          window.open(stylesnap_url, '_blank');
        } else if (text === 'AMZ') {
          // 保持原有的Amazon StyleSnap逻
          chrome.runtime.sendMessage({action: "fetchImage", url: imgUrl}, response => {
            if (response.error) {
              console.error('处理图片时出错:', response.error);
              alert('无法处理图片,请稍后再试。');
            } else {
              const imageDataUrl = response.data;
              simulateAmazonStyleSnap(imageDataUrl);
            }
          });
        }
      } else {
        console.error('无法获取图片URL');
        alert('无法获取图片URL,请稍后再试。');
      }
    } else {
      console.error('未找到图片元素');
      alert('未找到图片元素,请稍后再试。');
    }
  };

  return button;
}

function simulateAmazonStyleSnap(imageDataUrl) {
  chrome.runtime.sendMessage({
    action: 'openAmazonStyleSnap',
    imageDataUrl: imageDataUrl
  }, (response) => {
    if (chrome.runtime.lastError) {
      //console.error('发送消息时出错:', chrome.runtime.lastError);
      console.log('发送消息时出错:', chrome.runtime.lastError);
    } else {
      console.log('消息发送成功,响应:', response);
    }
  });
}

// 使用防抖函数来控制消息处理频率
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 处理搜索结果的函数
function handleSearchResult(message) {
  if (message.action === 'imageSearchResult') {
    searchResults.set(message.url, message.result);
    updateHelperCards();
  } else if (message.action === 'imageSearchError') {
    console.error('搜索图片时出错:', message.error);
    updateHelperCards(message.url, `错误: ${message.error}`);
  }
}

// 使用防抖包装处理函数
const debouncedHandleSearchResult = debounce(handleSearchResult, 300);

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到来自后台脚本的消息:', message);
  debouncedHandleSearchResult(message);
});

// 使用节流函数来控制 updateHelperCards 的调用频率
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// 节流版的 updateHelperCards
const throttledUpdateHelperCards = throttle(updateHelperCards, 500);

// 更新所有 helper cards
function updateHelperCards(errorUrl, errorMessage) {
  const searchButtons = document.querySelectorAll('.soku-ai-helper-button.search-button');
  searchButtons.forEach(button => {
    // 首先尝试查找产品卡片容器
    let container = button.closest('.S-product-card__img-container');
    // 如果没有找到产品卡片容器，则查找产品详情页的容器
    if (!container) {
      container = button.closest('.product-intro-zoom__item');
    }
    
    if (container) {
      // 在器中查找图片元素
      const imgElement = container.querySelector('.crop-image-container__img');
      if (imgElement && imgElement.src) {
        const imgUrl = imgElement.src;
        if (errorUrl && errorUrl === imgUrl) {
          button.textContent = '搜索失败';
          button.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        } else {
          const result = searchResults.get(imgUrl);
          if (result) {
            let bestMatch = null;
            let maxScore = 0;
            
            if (result.result && result.result.length > 0) {
              result.result.forEach(item => {
                if (item.score > 0.9 && item.score > maxScore) {
                  maxScore = item.score;
                  bestMatch = item;
                }
              });
              
              if (bestMatch) {
                // 将概率转换为百分比并保留两位小数
                const probability = (maxScore * 100).toFixed(2);
                button.textContent = `款号：${bestMatch.brief} 概率:${probability}%`;
                button.style.backgroundColor = 'rgba(0, 128, 0, 0.8)';
              } else {
                button.textContent = '无同款';
                button.style.backgroundColor = 'rgba(128, 128, 128, 0.8)';
              }
            } else {
              button.textContent = '无同款';
              button.style.backgroundColor = 'rgba(128, 128, 128, 0.8)';
            }
          } else {
            button.textContent = '搜索相似';
            button.style.backgroundColor = 'rgba(76, 175, 80, 0.8)';
          }
        }
      }
    }
  });
}

// 初始化函数
function initialize() {
  console.log('初始化 SOKU-AI 助手');
  const swiperButtonNext = document.querySelector('.swiper-button-next');
  if (swiperButtonNext) {
    swiperButtonNext.style.height = '70%';
  }
  // 使用 setTimeout 来延迟执行 addHelperCard
  setTimeout(() => {
    addHelperCard();
    
    // 设置 MutationObserver 来监视 DOM 变化
    const observer = new MutationObserver((mutations) => {
      let shouldAddHelperCard = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const addedNodes = mutation.addedNodes;
          for (const node of addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList.contains('S-product-card__img-container') || 
                  node.querySelector('.S-product-card__img-container:not([data-soku-ai-processed])')) {
                shouldAddHelperCard = true;
                break;
              }
            }
          }
        }
        if (shouldAddHelperCard) break;
      }
      if (shouldAddHelperCard) {
        addHelperCard();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }, 2000); // 延迟 2 秒执行
}

// 当页面加载完成后执行初始化函数
window.addEventListener('load', initialize);

// 在页面加载完成后调用
window.addEventListener('load', setupGlobalObserver);

function setupGlobalObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
        const target = mutation.target;
        if (target.tagName === 'IMG' && !target.src.includes('...')) {
          console.log('捕获到完整图片URL:', target.src);
          // 在这里处理捕获到的URL
        }
      }
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['src'],
    subtree: true
  });
}

function observeBuyerShows() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const buyerShows = document.querySelectorAll('.s-swiper-slide.customerreviews-details__image-slide-item:not([data-soku-ai-processed])');
        if (buyerShows.length > 0) {
          processBuyerShows(buyerShows);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 60秒后断开观察器
  setTimeout(() => observer.disconnect(), 60000);
}

function processBuyerShows(buyerShows) {
  for (const show of buyerShows) {
    if (show.getAttribute('data-soku-ai-processed') === 'true') {
      continue;
    }
    const imgElement = show.querySelector('img');
    if (imgElement && !show.querySelector('.soku-ai-download-button')) {
      addDownloadButtonToShow(show, imgElement);
      show.setAttribute('data-soku-ai-processed', 'true');
    }
  }
}

function addDownloadButtonToShow(show, imgElement) {
	const downloadButton = document.createElement('button');
	downloadButton.className = 'soku-ai-download-button';
	downloadButton.textContent = '���载';
	downloadButton.style.cssText = `
	  position: absolute;
	  bottom: 5px;
	  right: 5px;
	  z-index: 10000;
	  background-color: rgba(33, 150, 243, 0.8);
	  color: white;
	  border: none;
	  border-radius: 4px;
	  padding: 5px 10px;
	  cursor: pointer;
	  font-size: 12px;
	  font-weight: bold;
	  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
	  line-height: normal;

	`;
  
	downloadButton.onclick = (e) => {
	  e.preventDefault();
	  e.stopPropagation();
	  
	  const imgUrl = imgElement.src;
	  const imgAlt = imgElement.alt || 'shein_buyer_show';
	  
	  if (imgUrl) {
      console.log('Received iamge request for:', imgUrl);
		chrome.runtime.sendMessage({
		  action: 'downloadImage',
		  url: imgUrl,
		  filename: `${imgAlt}.jpg`
		}, (response) => {
		  if (response && response.success) {
			downloadButton.textContent = '下载成功';
			downloadButton.style.backgroundColor = 'rgba(76, 175, 80, 0.8)'; // 绿色
		  } else {
			downloadButton.textContent = '下载失败';
			downloadButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)'; // 红色
		  }
		  // 3秒后恢复按钮原状
		  setTimeout(() => {
			downloadButton.textContent = '下载';
			downloadButton.style.backgroundColor = 'rgba(33, 150, 243, 0.8)'; // 蓝色
		  }, 3000);
		});
	  } else {
		console.error('无法获取图片URL');
		downloadButton.textContent = '下载失败';
		downloadButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
	  }
	};
  
	show.style.position = 'relative';
	show.appendChild(downloadButton);
  
	function ensureButtonVisibility() {
	  downloadButton.style.zIndex = '10000';
	  downloadButton.style.pointerEvents = 'auto';
	  show.style.overflow = 'visible';
	}
  
	ensureButtonVisibility();
	setInterval(ensureButtonVisibility, 1000);
  }



// 在页面加载完成后调用
window.addEventListener('load', observeBuyerShows);


// 获取商品信息
function extractGbRawData() {
  const scripts = document.getElementsByTagName('script');
  for (const script of scripts) {
    const content = script.textContent || '';
    if (content.includes('window.gbRawData')) {
      try {
        // 使用正则表达式只匹配我们需要的数据部分
        const goodsSnMatch = content.match(/"goods_sn":"([^"]+)"/);
        const storeCodeMatch = content.match(/"store_code":(\d+)/);
        const productRelationIDMatch = content.match(/"productRelationID":"([^"]+)"/);
        const catIdMatch = content.match(/"cat_id":"([^"]+)"/);
        
        if (storeCodeMatch && goodsSnMatch && productRelationIDMatch && catIdMatch) {
          return {
              detail: {
                sku: goodsSnMatch?.[1] || '',
                store_code: storeCodeMatch?.[1] || '',
                goods_spu: productRelationIDMatch?.[1] || '',
                cat_id: catIdMatch?.[1] || ''
              }
          };
        }else{
          console.log('提取数据失败:', goodsSnMatch,storeCodeMatch,productRelationIDMatch,catIdMatch);
        }
        
      } catch (e) {
        console.error('提取数据失败:', e);
      }
    }
  }
  return null;
}


// 处理评论数据
function processReviewData(data) {
  try {
    const reviews = data.info?.comment_info || [];
    console.log('开始处理评论数据，共', reviews.length, '条评论');
    
    reviews.forEach(review => {
      const {
        user_name,
        content,
        comment_rank: rating,
        comment_time: created_at,
        comment_image: images
      } = review;
      
      console.log('评论详情:', {
        用户: user_name,
        内容: content,
        评分: rating,
        时间: created_at,
        图片数: images?.length || 0
      });
    });
  } catch (error) {
    console.error('处理评论数据时出错:', error);
  }
}

// 监听评论数据
function setupReviewListener() {
  console.log('设置评论监听器');
  window.addEventListener('reviewDataReceived', (event) => {
    console.log('收到评论数据:', event.detail.data);
    processReviewData(event.detail.data);
  });
}

// 修改token获取逻辑
async function getTokensFromBackground() {
  // 如果已经有有效的tokens,直接返回
  if (window._validTokens?.antiIn && window._validTokens?.armorToken) {
    console.log('从getTokensFromBackground成功获取所有token:', window._validTokens);
    return window._validTokens;
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({action: "getTokens"}, function(response) {
      if (response) {
        window._validTokens = response;
      }
      resolve(response);
    });
  });
}

// 修改等待token的函数
async function waitForTokens(timeout = 60000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    // 等待获取tokens的结果
    const tokens = await getTokensFromBackground();
    window._validTokens = tokens;
    
    // 检查是否获取到必要的token
    if (window._validTokens?.antiIn && window._validTokens?.armorToken) {
      console.log('成功获取所有token:', window._validTokens);
      return; // 这里会真正结束waitForTokens函数
    }
    
    console.log('token不完整,等待重试:', window._validTokens);
    // 等待一段时间后重试
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('等待token超时');
}


// 获取评论数据
async function triggerReviewRequest(page = 1, allReviews = []) {
  console.log('准备触发第', page, '页评论请求');
  
  try {
    await waitForTokens();
    
    const productInfo = extractGbRawData();
    if (!productInfo) {
      throw new Error('无法获取商品信息');
    }
    
    // 构建评论请求URL
    const url = new URL('https://us.shein.com/bff-api/product/get_goods_review_detail');
    const params = {
      '_ver': '1.1.8',
      '_lang': 'en',
      'page': page.toString(),
      'limit': '20',
      'offset': ((page - 1) * 20).toString(),
      'sort': '',
      'is_picture': '1',
      'comment_rank': '',
      'rule_id': '',
      'local_site_query_flag': '',
      'local_site_abt_flag': '',
      'goods_spu': productInfo.detail.goods_spu || '',
      'sku': productInfo.detail.sku || '',
      'store_code': productInfo.detail.store_code || '',
      'tag_rule_id': 'type%3DA',
      'store_comment_flag': '1',
      'cat_id': productInfo.detail.cat_id || '',
      'isLowestPriceProductOfBuyBox': '0',
      'mainProductSameGroupId': ''
    };
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url.toString(), true);
      
      // 设置请求头
      xhr.setRequestHeader('accept', 'application/json, text/plain, */*');
      xhr.setRequestHeader('accept-language', 'en');
      xhr.setRequestHeader('cache-control', 'no-cache');
      xhr.setRequestHeader('pragma', 'no-cache');
      xhr.setRequestHeader('webversion', '11.8.2');
      xhr.setRequestHeader('x-requested-with', 'XMLHttpRequest');
      
      // 设置动态token
      if (window._validTokens?.antiIn) {
        xhr.setRequestHeader('anti-in', window._validTokens.antiIn);
        console.log('设置 anti-in:', window._validTokens.antiIn);
      }
      
      if (window._validTokens?.armorToken) {
        xhr.setRequestHeader('armortoken', window._validTokens.armorToken);
        console.log('设置 armortoken:', window._validTokens.armorToken);
      }
      
      if (window._validTokens?.smdeviceid) {
        xhr.setRequestHeader('smdeviceid', window._validTokens.smdeviceid);
        console.log('设置 smdeviceid:', window._validTokens.smdeviceid);
      }
      
      if (window._validTokens?.gwAuth) {
        xhr.setRequestHeader('x-gw-auth', window._validTokens.gwAuth);
        console.log('设置 x-gw-auth:', window._validTokens.gwAuth);
      }
      
      xhr.onload = function() {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            console.log('获取第', page, '页评论数据');
            
            // 合并评论数据
            const reviews = data.info?.comment_info || [];
            allReviews.push(...reviews);
            
            // 检查是否还有下一页
            const hasNextPage = data.info?.hasNextFlag === "1";
            const totalNum = parseInt(data.info?.comment_num || 0);
            
            if (hasNextPage && allReviews.length < totalNum) {
              // 递归获取下一页
              setTimeout(() => {
                triggerReviewRequest(page + 1, allReviews);
              }, 1000);
            } else {
              // 所有评论获取完成，触发事件
              console.log('所有评论获取完成，总共:', allReviews.length, '条评论');
              window.dispatchEvent(new CustomEvent('reviewDataReceived', {
                detail: { 
                  data: {
                    ...data,
                    info: {
                      ...data.info,
                      comment_info: allReviews
                    }
                  }
                }
              }));
            }
            
            resolve(data);
          } catch (error) {
            console.error('解析响应失败:', error);
            reject(error);
          }
        } else {
          console.error('请求失败:', xhr.status, xhr.statusText);
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = function() {
        console.error('请求出错');
        reject(new Error('Network error'));
      };
      
      xhr.send();
    });
    
  } catch (error) {
    console.error('评论请求失败:', error);
    throw error;
  }
}



// 辅助函数：获取cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}


// 创建请求拦截器
function createRequestInterceptor() {
  console.log('开始创建请求拦截器');
  
  // 保存原始的fetch方法
  const originalFetch = window.fetch;
  
  // 初始化token存储
  window._validTokens = {
    antiIn: getCookie('anti-in') || document.querySelector('meta[name="anti-in"]')?.content,
    armorToken: getCookie('armortoken') || document.querySelector('meta[name="armortoken"]')?.content,
    csrfToken: document.querySelector('meta[name="csrf-token"]')?.content,
    gwAuth: '', // 这个需要动态获取
    smdeviceid: getCookie('smdeviceid')
  };
  
 

  // 拦截XHR请求
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    // 保存关键请求头
    if (header.toLowerCase() === 'x-gw-auth') {
      window._validTokens.gwAuth = value;
      console.log('SOKU捕获到gwAuth:', value);
    }
    return originalXHRSetRequestHeader.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    if (typeof url === 'string' && url.includes('get_goods_review_detail')) {
      console.log('SOKU拦截到评论请求:', {
        method,
        url,
        tokens: window._validTokens
      });
    }
    return originalXHROpen.apply(this, arguments);
  };

  // 替换fetch方法
  window.fetch = async function(...args) {
    const [url, config] = args;
    
    try {
      if (typeof url === 'string' && url.includes('get_goods_review_detail')) {
        console.log('SOKU拦截到评论fetch请求:', url);
        
        // 构建新的请求配置
        const newConfig = {
          ...config,
          headers: {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'anti-in': window._validTokens.antiIn,
            'armortoken': window._validTokens.armorToken,
            'x-csrf-token': window._validTokens.csrfToken,
            'x-gw-auth': window._validTokens.gwAuth,
            'smdeviceid': window._validTokens.smdeviceid,
            'x-requested-with': 'XMLHttpRequest',
            'webversion': '11.8.2',
            ...config?.headers
          },
          credentials: 'include'
        };
        
        console.log('SOKU使用的请求头:', newConfig.headers);
        
        // 发送请求
        const response = await originalFetch(url, newConfig);
        const responseClone = response.clone();
        
        try {
          const data = await responseClone.json();
          console.log('SOKU获取到评论数据:', data);
          window.dispatchEvent(new CustomEvent('reviewDataReceived', {
            detail: { data }
          }));
        } catch (error) {
          console.error('SOKU解析响应数据失败:', error);
        }
        
        return response;
      }
      
      return originalFetch(...args);
      
    } catch (error) {
      console.error('SOKU请求处理出错:', error);
      return originalFetch(...args);
    }
  };
		
  console.log('SOKU请求拦截器创建完成');
  console.log('当前token状态:', window._validTokens);
}
// 初始化
(async function initSOKU() {
  console.log('=== 评论功能初始化===');

  // 确保DOM加载完成后再执行数据获取
  if (document.readyState === 'loading') {
      await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
  }
  // 立即初始化请求拦截
  try {
    createRequestInterceptor();
    console.log('SOKU请求拦截器初始化成功');
  } catch (error) {
    console.error('SOKU请求拦截器初始化失败:', error);
  }
  
  // 等待DOM加载
  if (document.readyState !== 'loading') {
    setupFeatures();
  } else {
    document.addEventListener('DOMContentLoaded', setupFeatures);
  }
  
  function setupFeatures() {
    try {
      setupReviewListener();
      console.log('SOKU所有功能初始化完成');
      
      // 等待一段时间后触发评论请求
      setTimeout(() => {
        console.log('开始自动触发评论请求');
        triggerReviewRequest();
      }, 2000); // 等待2秒后触发
      
    } catch (error) {
      console.error('SOKU功能初始化失败:', error);
    }
  }
})();

