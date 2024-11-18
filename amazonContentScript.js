console.log('Amazon StyleSnap 内容脚本已加载 - ' + new Date().toISOString());

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Amazon页面收到消息:', request);
  if (request.action === 'simulateStyleSnap') {
    console.log('收到模拟StyleSnap操作的请求');
    simulateAmazonStyleSnap(request.imageDataUrl);
    sendResponse({status: 'received'});
  }
  return true;  // 保持消息通道开放
});

function simulateAmazonStyleSnap(imageDataUrl) {
  console.log('开始模拟StyleSnap操作');
  
  // 等待页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => performStyleSnap(imageDataUrl));
  } else {
    performStyleSnap(imageDataUrl);
  }
}

function performStyleSnap(imageDataUrl) {
  console.log('执行StyleSnap操作');
  
  const fileInput = document.querySelector('input[type="file"][accept="image/avif,image/*"]');
  if (fileInput) {
    // 将base64图片数据转换为Blob
    fetch(imageDataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], "image.png", { type: "image/png" });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        // 触发change事件
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);

        console.log('图片已成功上传到StyleSnap');
      })
      .catch(error => {
        console.error('上传图片时出错:', error);
        alert('上传图片时出错，请重试或手动上传。');
      });
  } else {
    console.error('未找到文件输入元素');
    alert('无法找到上传图片的位置，请手动上传。');
  }
}