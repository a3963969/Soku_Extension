document.addEventListener('DOMContentLoaded', function() {
  const imageInput = document.getElementById('imageInput');
  const imagePreview = document.getElementById('imagePreview');
  const uploadButton = document.getElementById('uploadButton');
  const briefInput = document.getElementById('briefInput');
  const classId1Input = document.getElementById('classId1Input');
  const classId2Input = document.getElementById('classId2Input');
  const resultDiv = document.getElementById('result');

  console.log('DOM content loaded'); // 调试信息

  imageInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        imagePreview.style.backgroundImage = `url(${e.target.result})`;
      }
      reader.readAsDataURL(file);
    }
  });

  uploadButton.addEventListener('click', function() {
    console.log('Upload button clicked'); // 调试信息
    if (!briefInput.value.trim()) {
      alert('请输入款号');
      return;
    }
    uploadImage();
  });

  function uploadImage() {
    console.log('uploadImage function called');
    const file = imageInput.files[0];
    if (!file) {
      resultDiv.textContent = '请选择一个图片文件';
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(function(blob) {
          const convertedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
            type: "image/jpeg",
            lastModified: new Date().getTime()
          });
          sendImageToBackground(convertedFile);
        }, 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function sendImageToBackground(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64Image = e.target.result.split(',')[1];
      
      const data = {
        image: base64Image,
        brief: briefInput.value,
        class_id1: classId1Input ? classId1Input.value : undefined,
        class_id2: classId2Input ? classId2Input.value : undefined
      };

      console.log('Sending message to background script', data);
      chrome.runtime.sendMessage({
        action: 'uploadImage',
        data: data
      }, function(response) {
        console.log('Received response from background script', response);
        if (response && response.success) {
          const result = response.data;
		  if (result.brief) {
            resultHTML = `<div class="result-item"><span class="result-label">款号：</span>${result.brief}</div>`;
		  }else{
			resultHTML = `<div class="result-item"><span class="result-label">款号：</span>${briefInput.value}上传成功</div>`;
		  }
          if (result.error_code) {
            resultHTML += `<div class="result-item"><span class="result-label">错误代码：</span>${result.error_code}</div>`;
          }
          
          if (result.error_msg) {
            resultHTML += `<div class="result-item"><span class="result-label">错误消息：</span>${result.error_msg}</div>`;
          }
          
          resultDiv.innerHTML = resultHTML;
        } else {
          resultDiv.innerHTML = `<div class="result-item error"><span class="result-label">上传失败：</span>${response ? response.error : '未知错误'}</div>`;
        }
      });
    };
    reader.readAsDataURL(file);
  }

  // 监听开关状态变化
  document.getElementById('reviewToggle').addEventListener('change', function(e) {
    chrome.storage.sync.set({
      reviewToggle: e.target.checked
    });
  });

  // 页面加载时恢复开关状态
  chrome.storage.sync.get(['reviewToggle'], function(result) {
    document.getElementById('reviewToggle').checked = result.reviewToggle === true;
  });
});

document.addEventListener('DOMContentLoaded', function() {
  const manifest = chrome.runtime.getManifest();
  document.querySelector('.version-number').textContent = manifest.version;
});
