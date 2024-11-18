
// 添加更多的调试信息
console.log('开始加载 SOKU 脚本...');

/*
async function analyzeProduct(description) {
  try {
      const response = await chrome.runtime.sendMessage({
          action: 'analyzeProduct',
          prompt: `分析这件商品: ${description}。请提供以下信息:
              1. 风格特点
              2. 适合场合
              3. 搭配建议`
      });
      
      if (response && response.success) {
          return response.data;
      } else {
          throw new Error(response?.error || '分析失败');
      }
  } catch (error) {
      console.error('商品分析请求失败:', error);
      throw error;
  }
}
*/

// 在文件最开始添加token相关代码
window._validTokens = {};

// 拦截器代码
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
const originalFetch = window.fetch;

// 存储搜索结果
const searchResults = new Map();

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    alert('复制成功');
  } catch (clipboardError) {
    alert('复制失败');
  }
};


// 处理图片URL，移除缩略图尺寸后缀
function getOriginalImageUrl(imgUrl) {
  if (!imgUrl) return '';
  
  return imgUrl
  .replace(/_thumbnail_\d+x\d+\.webp$/, '.jpg')  // 处理 _thumbnail_999x999.webp
  .replace(/_\d+x\d+\.webp$/, '.jpg')            // 处理 _999x999.webp
  .replace(/thumbnail_\d+x\d+\.webp$/, '.jpg')   // 处理 thumbnail_999x999.webp
  .replace(/\d+x\d+\.webp$/, '.jpg')             // 处理 999x999.webp
  .replace(/\.webp$/, '.jpg'); 
}

async function downloadImagesAsZip(urls, zipName) {
  try {
    const imagePromises = urls.map(url => 
      new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('请求超时'));
        }, 30000); // 30秒超时

        chrome.runtime.sendMessage(
          { action: 'fetchImage', url: url },
          function(response) {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              console.warn('获取图片出错:', chrome.runtime.lastError);
              reject(new Error('获取图片失败'));
              return;
            }
            
            if (!response || !response.success || !response.data) {
              reject(new Error('无效的响应数据'));
              return;
            }
            
            resolve(response.data);
          }
        );
      }).catch(err => {
        console.warn(`获取图片失败 ${url}:`, err);
        return null; // 返回 null 而不是中断整个过程
      })
    );
    
    console.log('开始获取图片...');
    const imageDataUrls = (await Promise.all(imagePromises)).filter(Boolean); // 过滤掉失败的请求
    console.log(`成功获取 ${imageDataUrls.length}/${urls.length} 张图片`);
    
    if (imageDataUrls.length === 0) {
      throw new Error('没有成功获取任何图片');
    }
    
    // 创建 zip 文件
    const zip = new JSZip();
    
    imageDataUrls.forEach((dataUrl, index) => {
      try {
        const imageData = dataUrl.split(',')[1];
        zip.file(`image_${index + 1}.jpg`, imageData, {base64: true});
      } catch (err) {
        console.warn(`添加图片到 zip 失败 ${index}:`, err);
      }
    });
    
    // 生成并下载 zip 文件
    const content = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
    
    const downloadUrl = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${zipName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    
    console.log('Zip 文件创建完成并开始下载');
    
  } catch (error) {
    console.error('下载图片集合失败:', error);
    throw error;
  }
}

//添加一键下载主图按钮函数
function addDownloadButtonCard() {
  const product_intro__thumbs = document.querySelectorAll('.product-intro__thumbs-inner:not([data-soku-ai-processed])');
  for (const thumb of product_intro__thumbs) {
    const oneDownloadButton = document.createElement('button');
    oneDownloadButton.className = 'soku-ai-download-button';
    oneDownloadButton.textContent = '一键下载主图';
    oneDownloadButton.style.cssText = `
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
    //添加点击事件
    oneDownloadButton.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      downloadAllImages(thumb);
    };
    thumb.appendChild(oneDownloadButton);
  }
}
//下载所有主图函数
function downloadAllImages(thumb) {
  const imgElements = thumb.querySelectorAll('.product-intro__thumbs-item .crop-image-container .crop-image-container__img');
  console.log('imgElements:', imgElements);
  
  if (imgElements && imgElements.length > 0) {
    imgElements.forEach(img => {
      const imgUrl = getOriginalImageUrl(img.currentSrc || img.src);
      const imgAlt = img.alt || 'shein_image';
      chrome.runtime.sendMessage({
        action: 'downloadImage', 
        url: imgUrl, 
        filename: `${imgAlt}.jpg`
      });
    });
  }
}

// 添加新的按钮到指定的产品卡片，显示图片地址并进行图片搜索
function addHelperCard() {
  const productCards = document.querySelectorAll('.S-product-card__img-container:not([data-soku-ai-processed])');
  //const productCards =document.querySelectorAll('.cursor-zoom-in.s-swiper-slide.product-intro__main-item .product-intro-zoom__item');
		
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
    //const productMain = document.querySelectorAll('.cursor-zoom-in.s-swiper-slide.product-intro__main-item .product-intro-zoom__item');
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

          //const analysis = await analyzeProduct('描述');
         // console.log('分析结果:', analysis);

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
// 添加评论区域
function addReviewSummaryAndButton(review_num_total, like_num_total,comment_image_array) {
  const targetElement = document.querySelector('#goods-detail-v3 > div.goods-detailv2 > div.goods-detailv2__media > div > div.product-intro > div.product-intro__info > div.product-intro__info-sticky > div.product-intro__head.j-expose__product-intro__head');
  console.log('addReviewSummaryAndButton targetElement:', targetElement);
  if (targetElement) {
    // 创建评论信息容器
    const reviewSummaryContainer = document.createElement('div');
    reviewSummaryContainer.style = `
      display: flex;
      padding: 5px;
      align-items: center; /* 水平居中 */
      margin-bottom: 10px;
      background-color: #fff7e2;
      border-radius: 8px;
      font-size: 14px;
      color: #333;
      line-height: 1.6;
    `;
    
    // 添加评论信息
    reviewSummaryContainer.innerHTML = `
      <p style="margin: 5px 5px;">带图总数: <span style="color: red;">${review_num_total}</span></p>
      <p style="margin: 5px 5px;">点赞总数: <span style="color: red;">${like_num_total}</span></p>
      <p style="margin: 5px 5px;">买家秀数: <span style="color: red;">${comment_image_array.length}</span></p>
    `;
    
    // 创建“下载买家秀合集”按钮
    const downloadButton = document.createElement('button');
    downloadButton.textContent = '批量下载';
    downloadButton.style = `
      display: block;
      margin-left: 10px;
      padding: 3px 6px;
      background-color: rgba(76, 175, 80, 0.8);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;
    
    // 添加按钮点击事件
    downloadButton.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 显示下载中状态
      downloadButton.textContent = '打包下载中...';
      downloadButton.style.backgroundColor = 'rgba(255, 165, 0, 0.8)';
      downloadButton.disabled = true;

      try {
        console.log('开始下载买家秀图片', comment_image_array);
        const originalImages = comment_image_array.map(({member_image_original}) => member_image_original);
       // const processedImages = originalImages.map(imgUrl => getOriginalImageUrl(imgUrl));
        const baseUrl = "https://img.shein.com/";
        const fullUrls = originalImages.map(path => baseUrl + path);
        await downloadImagesAsZip(fullUrls, 'shein_buyer_shows'); 
        
        // 下载成功状态
        downloadButton.textContent = '下载成功';
        downloadButton.style.backgroundColor = 'rgba(76, 175, 80, 0.8)';
      } catch (error) {
        // 下载失败状态
        downloadButton.textContent = '下载失败';
        console.error('Failed to download images:', error);
        downloadButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
      }

      // 3秒后恢复原状
      setTimeout(() => {
        downloadButton.textContent = '批量下载';
        downloadButton.style.backgroundColor = 'rgba(33, 150, 243, 0.8)';
        downloadButton.disabled = false;
      }, 3000);
    };
    
    // 将评论信息和按钮添加到目标元素
    reviewSummaryContainer.appendChild(downloadButton);
    targetElement.prepend(reviewSummaryContainer);
  } else {
    console.error('未找到目标元素');
  }
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
    //一键下载主图
    addDownloadButtonCard();
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
  // 添加节流控制
  let processingTimeout = null;
  
  const observer = new MutationObserver((mutations) => {
    // 如果已经有待处理的任务，就不再触发新的处理
    if (processingTimeout) {
      return;
    }

    // 设置300ms的节流时间
    processingTimeout = setTimeout(() => {
      const buyerShows = document.querySelectorAll('.s-swiper-slide.customerreviews-details__image-slide-item:not([data-soku-ai-processed])');
      if (buyerShows.length > 0) {
        processBuyerShows(buyerShows);
      }
      processingTimeout = null;
    }, 2000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
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

// 添加下载按钮到买家秀
function addDownloadButtonToShow(show, imgElement) {
	const downloadButton = document.createElement('button');
	downloadButton.className = 'soku-ai-download-button';
	downloadButton.textContent = '下载';
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

// 获取商品颜色信息
function extractColorData() {
  const scripts = document.getElementsByTagName('script');
  for (const script of scripts) {
    const content = script.textContent || '';
    if (content.includes('window.gbRawData')) {
      try {
        // 使用正则表达式只匹配我们需要的数据部分
        const spuMatch = content.match(/"productRelationID":"([^"]+)"/);
        const colorDataMatch = content.match(/"colorData":\s*({[\s\S]*?"showFindMyShadeEntry":\s*\w+\s*})/);
        if (colorDataMatch && colorDataMatch[1]) {
            try {
              const colorData = JSON.parse(colorDataMatch[1]);
              if (colorData.colorList && Array.isArray(colorData.colorList)) {
                  const goodsInfo = colorData.colorList.map(item => ({
                      goods_id: item.goods_id,
                      goods_title: item.goods_title,
                      goods_image: item.goods_img,
                      color: item.sort?.attr_value,
                      isCurrentGoods: item.isCurrentGoods,
                      goods_spu: spuMatch?.[1] || ''
                  }));
                  console.log('商品信息:', goodsInfo);
                  return goodsInfo; // 添加这行来返回处理后的数据
              }
          } catch (error) {
              console.error('解析失败:', error);
              // 调试用
              console.log('匹配到的数据前100个字符:', colorDataMatch[1].substring(0, 100));
          }
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
  //console.log('processReviewData评论数据:',data);
  try {
    const reviews = data || [];
    const review_num_total = reviews.length;
    let like_num_total = 0;
    let comment_image_array = [];
    console.log('processReviewData评论数据:',reviews);
    reviews.forEach(review => {
      const {
        user_name,
        content,
        comment_rank: rating,
        comment_time: created_at,
        comment_image: images,
        like_num: like_num,
        comment_image: comment_image
      } = review;
      like_num_total += parseInt(like_num, 10); // 将 like_num 转换为数字
      if(comment_image){
        comment_image_array.push(...comment_image);
      }
    });
    console.log('评论点赞总数:', like_num_total);
    console.log('评论总数:', review_num_total);
    console.log('评论图片数:', comment_image_array.length);
    console.log('评论图片合集:', comment_image_array);
    
    addReviewSummaryAndButton(review_num_total, like_num_total,comment_image_array);
      

  } catch (error) {
    console.error('处理评论数据时出错:', error);
  }
}



// 修改token获取逻辑
async function getTokensFromBackground() {
  // 如果已经有有效的tokens,直接返回
  if (window._validTokens?.antiIn && window._validTokens?.armorToken) {
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
      return; // 这里会真正结束waitForTokens函数
    }
    
    console.log('token不完整,等待重试:', window._validTokens);
    // 等待一段时间后重试
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('等待token超时');
}


// ... existing code ...

// 通用的请求函数
async function makeRequest(url, params = {}, options = {}) {
  try {
    await waitForTokens();
    
    const requestUrl = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        requestUrl.searchParams.set(key, value);
      }
    });
    //console.log('请求数据:',requestUrl);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || 'GET', requestUrl.toString(), true);
      
      // 默认请求头
      const defaultHeaders = {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'webversion': '11.8.2',
        'x-requested-with': 'XMLHttpRequest'
      };

      // 合并默认请求头和自定义请求头
      const headers = { ...defaultHeaders, ...options.headers };
      
      // 设置请求头
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
      
      // 自动添加token请求头
      const tokenHeaders = {
        'anti-in': window._validTokens?.antiIn,
        'armortoken': window._validTokens?.armorToken,
        'smdeviceid': window._validTokens?.smdeviceid,
        'x-gw-auth': window._validTokens?.gwAuth
      };

      Object.entries(tokenHeaders).forEach(([key, value]) => {
        if (value) xhr.setRequestHeader(key, value);
      });
      
      xhr.onload = function() {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (error) {
            reject(new Error('解析响应失败: ' + error.message));
          }
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = () => reject(new Error('Network error'));
      
      xhr.send(options.body);
    });
    
  } catch (error) {
    console.error('请求失败:', error);
    throw error;
  }
}

// 重构后的评论请求函数
async function triggerReviewRequest(page = 1, allReviews = [],url,params,colorname) {
  console.log('颜色:',colorname,':准备触发第', page, '页评论请求');
  
  try {
    params.page = page.toString();
    params.offset = ((page - 1) * 20).toString();
    params._ver = '1.1.8';
    params._lang = 'en';
    params.limit = '20';
    params.sort = '';
    params.comment_rank = '';
    params.rule_id = '';
    params.local_site_query_flag = '';
    params.local_site_abt_flag = '';
    params.store_comment_flag = '1';
    params.isLowestPriceProductOfBuyBox = '0';
    params.mainProductSameGroupId = '';

    const data = await makeRequest(url, params);

    // 处理评论数据
    const reviews = data.info?.comment_info || [];
    
    //找所有颜色才需要翻页
    if(colorname=='0'){
      // 检查是否还有下一页
      allReviews.push(...reviews);

      const hasNextPage = data.info?.hasNextFlag === "1";
      const totalNum = parseInt(data.info?.comment_num || 0);
      
      if (hasNextPage && allReviews.length < totalNum) {
        // 递归获取下一页
        await new Promise(resolve => setTimeout(resolve, 1000));
        return triggerReviewRequest(page + 1, allReviews,url,params,colorname);
      }
      console.log('颜色:',colorname,':所有评论获取完成，总共:', allReviews.length, '条评论,评论内容:',allReviews);
      return allReviews;
    }else{
      return data.info;
    }
    
    
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
      //console.log('SOKU捕获到gwAuth:', value);
    }
    return originalXHRSetRequestHeader.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
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


// 检查开关状态的函数
async function checkReviewToggle() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['reviewToggle'], (result) => {
      resolve(result.reviewToggle === true);
    });
  });
}
// 初始化函数
(async function initSOKU() {
  console.log('=== 评论功能初始化 ===');

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
      console.log('SOKU所有功能初始化完成');
      // 等待一段时间后触发评论请求
      setTimeout(() => {
        console.log('开始自动触发评论请求');

        const productInfo = extractGbRawData();
        if (!productInfo) {
          throw new Error('无法获取商品信息');
        }
        const params_all_reviews = {
          'sku': productInfo.detail.sku || '',
          'goods_spu': productInfo.detail.goods_spu || '',
          'store_code': productInfo.detail.store_code || '',
          'cat_id': productInfo.detail.cat_id || '',
        };

        //显示卖家评论
         
        const color_data = extractColorData();
        console.log('获取到颜色数据:', color_data);
        
        if (color_data && color_data.length > 0) {
          const processAllColors = async () => {
            console.log('开始处理颜色数据...');
            if (document.readyState !== 'complete') {
              await new Promise(resolve => {
                window.addEventListener('load', resolve);
              });
            }
             // 检查开关状态
            const isReviewEnabled = await checkReviewToggle();
            
            // 只有当开关打开时才执行评论相关代码
            if (isReviewEnabled) {
            // 获取所有颜色评论
              const reviewData = await triggerReviewRequest(
                1,  
                [], 
                'https://us.shein.com/bff-api/product/get_goods_review_detail',
                params_all_reviews, 
                '0' 
              );
              await processReviewData(reviewData);
            }

            const waitForColorContainer = () => {
              return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 20;
                
                const check = () => {
                  attempts++;
                  console.log(`第 ${attempts} 次尝试查找颜色容器...`);
                  
                  const container = document.querySelector('.goods-color__radio-container');
                  if (container) {
                    console.log('成功找到颜色容器:', container);
                    
                    // 添加复制按钮
                    const copyButton = document.createElement('span');
                    copyButton.className = 'sui-popover__trigger';
                    copyButton.innerHTML = `
                      <div class="goods-color__radio goods-color__radio_radio" tabindex="0" aria-label="复制">
                        <div class="radio-inner" style="display:flex;align-items:center;justify-content:center;">
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                          </svg>
                        </div>
                      </div>
                    `;
                    
                    copyButton.style.cssText = `
                      position: relative;
                      margin-left: 8px;
                      cursor: pointer;
                    `;
                    // 添加图片按钮
                    const imgButton = document.createElement('span');
                    imgButton.className = 'sui-popover__trigger';
                    imgButton.innerHTML = `
                      <div class="goods-color__radio goods-color__radio_radio" tabindex="0" aria-label="图片">
                        <div class="radio-inner" style="display:flex;align-items:center;justify-content:center;">
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                          </svg>
                        </div>
                      </div>
                    `;

                    imgButton.style.cssText = `
                      position: relative;
                      margin-left: 8px;
                      cursor: pointer;
                    `;


                    // 添加点击事件
                    copyButton.onclick = async () => {
                      try {
                        const productInfo = extractGbRawData();
                        if (!productInfo) {
                          throw new Error('无法获取商品信息');
                        }
                        
                        const color_data = extractColorData();
                        if (!color_data || color_data.length === 0) {
                          throw new Error('未找到颜色数据');
                        }

                        // 处理每个颜色
                        for (const colorItem of color_data) {
                          await new Promise(resolve => setTimeout(resolve, 1000));
                          
                          try {
                            const colorSpans = colorContainer.querySelectorAll('span.sui-popover__trigger');

                            for (const span of colorSpans) {
                              const colorDiv = span.querySelector('.goods-color__radio');
                              const colorLabel = colorDiv?.getAttribute('aria-label');
                              const goodsId = span.getAttribute('goods-id');
                              
                              // 检查是否匹配当前颜色项
                              if (colorLabel === colorItem.color && goodsId === colorItem.goods_id.toString()) {
                                // 构建评论请求参数
                                const params_color = {
                                  '_ver': '1.1.8',
                                  '_lang': 'en',
                                  'spu': '',
                                  'goods_id': colorItem.goods_id,
                                  'page': '1',
                                  'limit': '20',
                                  'offset': '0',
                                  'sort': '',
                                  'size': '',
                                  'is_picture': '',
                                  'comment_rank': '',
                                  'rule_id': '',
                                  'local_site_query_flag': '',
                                  'local_site_abt_flag': '',
                                  'sku': productInfo.detail.sku || '',
                                  'tag_id': '',
                                  'goods_spu': productInfo.detail.goods_spu || '',
                                  'store_code': productInfo.detail.store_code || '',
                                  'tag_rule_id': '',
                                  'store_comment_flag': '1',
                                  'cat_id': productInfo.detail.cat_id || '',
                                  'isLowestPriceProductOfBuyBox': '0',
                                  'mainProductSameGroupId': ''
                                };
                                
                                const sku_color_data = await triggerReviewRequest(
                                  1, 
                                  [], 
                                  'https://us.shein.com/bff-api/product/get_goods_review_detail',
                                  params_color, 
                                  colorItem.color
                                );
                                //console.log('获取到颜色评论数据:', sku_color_data);
                                // 更新或创建数字标记
                                let numberMark = span.querySelector('.soku-number-mark');
                                if (!numberMark) {
                                  numberMark = document.createElement('div');
                                  numberMark.className = 'soku-number-mark';
                                  numberMark.style.cssText = `
                                    position: absolute;
                                    bottom: 5px;
                                    right: -1px;
                                    background-color: red;
                                    color: white;
                                    border-radius: 50%;
                                    width: 16px;
                                    height: 16px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 10px;
                                    z-index: 10000;
                                    pointer-events: none;
                                    user-select: none;
                                  `;
                                  
                                  if (getComputedStyle(span).position === 'static') {
                                    span.style.position = 'relative';
                                  }
                                  span.appendChild(numberMark);
                                }

                                // 更新数字标记的值
                                console.log('sku_color_data:', sku_color_data);
                                if (sku_color_data && sku_color_data.comment_num) {
                                  numberMark.textContent = sku_color_data.comment_num;
                                }
                                
                                break;
                              }
                            }
                          } catch (error) {
                            console.error(`评论数据失败:`, error);
                          }
                        }
                        

                        // 收集并复制数据
                        const colorData = [];
                        container.querySelectorAll('.soku-number-mark').forEach(mark => {
                          const span = mark.closest('.sui-popover__trigger');
                          const colorLabel = span.querySelector('.goods-color__radio')?.getAttribute('aria-label');
                          // 处理图片URL，移除尺寸后缀
                          console.log('colorLabel:', colorLabel);
                          const count = mark.textContent;
                          if(colorLabel && count) {
                            colorData.push(`${colorLabel}: ${count}`);
                          }
                        });
                        
                        const text = colorData.join('\n');
                        if (colorData.length > 0) {  // 确保有数据
                          console.log('准备复制的内容:', text);  // 调试用
                          await copyToClipboard(text);
                        }


                      } catch (err) {
                        console.error('处理颜色数据时出错:', err);
                        alert('处理颜色数据时出错:' +err);
                      }
                    };

                    imgButton.onclick = async () => {
                      try {
                        // 确保有颜色数据
                        if (!color_data || color_data.length === 0) {
                          alert('未找到颜色数据');
                          return;
                        }
                    
                        // 收集所有颜色的标题和图片URL
                        const imageData = color_data.map(item => {
                          let imgUrl = item.goods_image;
                          // 处理图片URL
                          if (imgUrl) {
                            // 移除缩略图后缀
                            imgUrl = getOriginalImageUrl(imgUrl);
                            
                            // 添加https前缀
                            if (imgUrl.startsWith('//')) {
                              imgUrl = 'https:' + imgUrl;
                            }
                          }
                    
                          return `${item.goods_title} ${imgUrl}`;
                        });
                    
                        // 将数据组合成文本并复制到剪贴板
                        const text = imageData.join('\n');
                        await copyToClipboard(text);
                    
                      } catch (err) {
                        console.error('处理图片数据时出错:', err);
                        alert(`处理图片数据时出错: ${err}`);
                      }
                    };

                    container.appendChild(copyButton);
                    container.appendChild(imgButton);
                    resolve(container);
                  } else if (attempts >= maxAttempts) {
                    console.log('达到最大尝试次数，未找到颜色容器');
                    resolve(null);
                  } else {
                    console.log('未找到颜色容器，500ms后重试');
                    setTimeout(check, 500);
                  }
                };
                
                check();
              });
            };
            
            // 等待颜色容器加载
            const colorContainer = await waitForColorContainer();
            
            if (!colorContainer) {
              console.error('无法找到颜色容器，退出处理');
              return;
            }
            
            console.log('开始处理颜色数据，颜色总数:', color_data.length);



          };

          // 调用处理颜色的函数
          processAllColors().catch(error => {
            console.error('处理颜色数据时出错:', error);
          });
          
        } else {
          console.log('未找到颜色数据', color_data);
        }
      }, 2000); // 等待2秒后触发
    } catch (error) {
      console.error('SOKU功能初始化失败:', error);
    }
  }
})();

