// 전역 변수
let video = null;
let canvas = null;
let ctx = null;
let extractedFrames = [];
let currentInterval = 0.1;
let currentFormat = 'png';
let currentScale = 1;
let isExtracting = false;
let selectedFrames = new Set();
let currentLightboxIndex = -1;

// DOM 요소를 담을 객체
let elements = {};

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    // Lucide 아이콘 초기화
    lucide.createIcons();

    // DOM 요소 캐싱
    cacheElements();

    // 비디오 및 캔버스 초기화
    video = elements.videoPlayer;
    canvas = elements.frameCanvas;
    ctx = canvas.getContext('2d');

    // 이벤트 리스너 설정
    setupEventListeners();

    // 초기 갤러리 상태 설정
    updateGalleryDisplay();
});

// DOM 요소 캐싱
function cacheElements() {
    elements = {
        uploadArea: document.getElementById('uploadArea'),
        uploadCard: document.getElementById('uploadCard'),
        videoInput: document.getElementById('videoInput'),
        videoCard: document.getElementById('videoCard'),
        videoPlayer: document.getElementById('videoPlayer'),
        frameCanvas: document.getElementById('frameCanvas'),
        controlCard: document.getElementById('controlCard'),
        progressCard: document.getElementById('progressCard'),
        frameGrid: document.getElementById('frameGrid'),
        emptyGallery: document.getElementById('emptyGallery'),
        toast: document.getElementById('toast'),
        urlInput: document.getElementById('urlInput'),
        loadUrlBtn: document.getElementById('loadUrlBtn'),
        extractCurrentBtn: document.getElementById('extractCurrentBtn'),
        extractAllBtn: document.getElementById('extractAllBtn'),
        cancelExtractBtn: document.getElementById('cancelExtractBtn'),
        selectAllBtn: document.getElementById('selectAllBtn'),
        deleteSelectedBtn: document.getElementById('deleteSelectedBtn'),
        downloadAllBtn: document.getElementById('downloadAllBtn'),
        closeBtn: document.getElementById('closeBtn'),
        // Select dropdowns
        intervalSelect: document.getElementById('intervalSelect'),
        formatSelect: document.getElementById('formatSelect'),
        scaleSelect: document.getElementById('scaleSelect'),
        // Lightbox elements
        lightbox: document.getElementById('lightbox'),
        lightboxImage: document.getElementById('lightboxImage'),
        lightboxTime: document.getElementById('lightboxTime'),
        lightboxClose: document.getElementById('lightboxClose'),
        lightboxPrev: document.getElementById('lightboxPrev'),
        lightboxNext: document.getElementById('lightboxNext'),
        lightboxDownload: document.getElementById('lightboxDownload')
    };
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 업로드 영역 클릭
    elements.uploadArea.addEventListener('click', (e) => {
        if (!e.target.closest('.url-section')) {
            elements.videoInput.click();
        }
    });

    // 파일 선택
    elements.videoInput.addEventListener('change', handleFileSelect);

    // URL 로드
    elements.loadUrlBtn.addEventListener('click', handleUrlLoad);
    elements.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleUrlLoad();
        }
    });

    // 드래그 앤 드롭
    setupDragAndDrop();

    // 비디오 이벤트
    setupVideoEvents();

    // 컨트롤 버튼
    setupControlButtons();

    // 갤러리 액션
    setupGalleryActions();

    // 라이트박스 이벤트
    setupLightboxEvents();

    // 닫기 버튼
    elements.closeBtn.addEventListener('click', resetAll);
}

// 드래그 앤 드롭 설정
function setupDragAndDrop() {
    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('drag-over');
    });

    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('drag-over');
    });

    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

// 비디오 이벤트 설정
function setupVideoEvents() {
    elements.videoPlayer.addEventListener('loadedmetadata', () => {
        updateVideoInfo();
    });

    elements.videoPlayer.addEventListener('loadeddata', () => {
        video.currentTime = 0.01;
        showToast('비디오 로드 완료');
    });
}

// 컨트롤 버튼 설정
function setupControlButtons() {
    // 추출 간격 드롭다운
    if (elements.intervalSelect) {
        elements.intervalSelect.addEventListener('change', (e) => {
            currentInterval = parseFloat(e.target.value);
            updateEstimatedFrames();
        });
    }

    // 이미지 포맷 드롭다운
    if (elements.formatSelect) {
        elements.formatSelect.addEventListener('change', (e) => {
            currentFormat = e.target.value;
        });
    }

    // 업스케일링 드롭다운
    if (elements.scaleSelect) {
        elements.scaleSelect.addEventListener('change', (e) => {
            currentScale = parseInt(e.target.value);
            updateEstimatedFrames();
        });
    }

    // 추출 버튼
    elements.extractCurrentBtn.addEventListener('click', extractCurrentFrame);
    elements.extractAllBtn.addEventListener('click', extractFrames);
    elements.cancelExtractBtn.addEventListener('click', cancelExtraction);
}

// 갤러리 액션 설정
function setupGalleryActions() {
    elements.selectAllBtn.addEventListener('click', selectAllFrames);
    elements.deleteSelectedBtn.addEventListener('click', deleteSelectedFrames);
    elements.downloadAllBtn.addEventListener('click', downloadAllFrames);
}

// 파일 선택 처리
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// 파일 처리
function handleFile(file) {
    if (!file.type.startsWith('video/')) {
        showToast('비디오 파일만 업로드 가능합니다.');
        return;
    }

    const url = URL.createObjectURL(file);
    loadVideo(url, file.name);
}

// URL 로드 처리
async function handleUrlLoad() {
    const url = elements.urlInput.value.trim();

    if (!url) {
        showToast('URL을 입력해주세요.');
        return;
    }

    if (!isValidUrl(url)) {
        showToast('올바른 URL을 입력해주세요.');
        return;
    }

    elements.loadUrlBtn.disabled = true;
    elements.loadUrlBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> 로딩 중...';
    lucide.createIcons();

    try {
        const videoUrl = await processVideoUrl(url);
        loadVideo(videoUrl, getFileNameFromUrl(videoUrl));
        elements.urlInput.value = '';
        showToast('비디오 로드 성공!');
    } catch (error) {
        console.error('URL 로드 실패:', error);
        if (error.message) {
            showToast(error.message);
        } else {
            showToast('비디오 로드에 실패했습니다.');
        }
    } finally {
        elements.loadUrlBtn.disabled = false;
        elements.loadUrlBtn.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i> URL 로드';
        lucide.createIcons();
    }
}

// 비디오 로드
function loadVideo(url, fileName = 'video') {
    elements.videoPlayer.src = url;
    elements.videoPlayer.preload = 'auto';
    elements.videoPlayer.muted = true;
    elements.videoPlayer.crossOrigin = 'anonymous';

    // 에러 처리
    elements.videoPlayer.onerror = handleVideoError;

    // UI 업데이트 - 카드를 보이게 하고 업로드 영역 숨기기
    showVideoInterface();
    showToast('비디오 로드 중...');
}

// 비디오 인터페이스 표시
function showVideoInterface() {
    elements.uploadCard.style.display = 'none';
    elements.videoCard.style.display = 'block';
    elements.controlCard.style.display = 'block';
}

// 비디오 에러 처리
function handleVideoError(e) {
    console.error('비디오 로드 오류:', e);

    const error = elements.videoPlayer.error;
    let errorMessage = '비디오를 로드할 수 없습니다.';

    if (error) {
        switch (error.code) {
            case 1:
                errorMessage = '비디오 로드가 중단되었습니다.';
                break;
            case 2:
                errorMessage = '네트워크 오류가 발생했습니다.';
                break;
            case 3:
                errorMessage = '비디오 디코딩 오류가 발생했습니다.';
                break;
            case 4:
                errorMessage = '지원되지 않는 비디오 형식입니다.';
                break;
        }
    }

    showToast(errorMessage);
    resetVideoInterface();
}

// 비디오 인터페이스 초기화
function resetVideoInterface() {
    elements.uploadCard.style.display = 'block';
    elements.videoCard.style.display = 'none';
    elements.controlCard.style.display = 'none';
    elements.progressCard.style.display = 'none';
    elements.urlInput.value = '';
}

// 비디오 정보 업데이트
function updateVideoInfo() {
    const duration = video.duration;
    document.getElementById('videoDuration').textContent = formatTime(duration);
    updateEstimatedFrames();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
}

// 예상 프레임 수 업데이트
function updateEstimatedFrames() {
    if (!video || !video.duration) return;
    const frameCount = Math.floor(video.duration / currentInterval);
    document.getElementById('estimatedFrames').textContent = `${frameCount}개`;
}

// 현재 프레임 추출
function extractCurrentFrame() {
    if (!video) {
        showToast('먼저 비디오를 로드해주세요.');
        return;
    }

    const scaledCanvas = document.createElement('canvas');
    const scaledCtx = scaledCanvas.getContext('2d');
    scaledCanvas.width = video.videoWidth * currentScale;
    scaledCanvas.height = video.videoHeight * currentScale;

    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.imageSmoothingQuality = 'high';
    scaledCtx.drawImage(video, 0, 0, scaledCanvas.width, scaledCanvas.height);

    const quality = currentFormat === 'jpeg' ? 0.95 : 1.0;
    scaledCanvas.toBlob((blob) => {
        const frameData = {
            id: Date.now(),
            blob: blob,
            time: video.currentTime,
            url: URL.createObjectURL(blob)
        };

        extractedFrames.push(frameData);
        addFrameToGallery(frameData);
        showToast('현재 프레임이 추출되었습니다.');
    }, `image/${currentFormat}`, quality);
}

// 전체 프레임 추출
async function extractFrames() {
    if (!video) {
        showToast('먼저 비디오를 로드해주세요.');
        return;
    }

    if (isExtracting) {
        showToast('이미 추출 중입니다.');
        return;
    }

    isExtracting = true;
    extractedFrames = [];
    elements.frameGrid.innerHTML = '';

    // UI 업데이트
    elements.progressCard.style.display = 'block';
    updateGalleryDisplay();

    const duration = video.duration;
    const totalFrames = Math.floor(duration / currentInterval);
    let extractedCount = 0;

    document.getElementById('totalFrames').textContent = totalFrames;

    for (let time = 0; time < duration; time += currentInterval) {
        if (!isExtracting) break;

        await seekAndExtract(time);
        extractedCount++;

        updateProgress(extractedCount, totalFrames);
        document.getElementById('currentFrame').textContent = extractedCount;
    }

    isExtracting = false;
    elements.progressCard.style.display = 'none';

    if (extractedCount > 0) {
        showToast(`${extractedCount}개의 프레임이 추출되었습니다.`);
    }
}

// 비디오 시간 이동 및 프레임 추출
function seekAndExtract(time) {
    return new Promise((resolve) => {
        video.currentTime = time;
        video.onseeked = () => {
            const scaledCanvas = document.createElement('canvas');
            const scaledCtx = scaledCanvas.getContext('2d');
            scaledCanvas.width = video.videoWidth * currentScale;
            scaledCanvas.height = video.videoHeight * currentScale;

            scaledCtx.imageSmoothingEnabled = true;
            scaledCtx.imageSmoothingQuality = 'high';
            scaledCtx.drawImage(video, 0, 0, scaledCanvas.width, scaledCanvas.height);

            const quality = currentFormat === 'jpeg' ? 0.95 : 1.0;
            scaledCanvas.toBlob((blob) => {
                const frameData = {
                    id: Date.now() + Math.random(),
                    blob: blob,
                    time: time,
                    url: URL.createObjectURL(blob)
                };

                extractedFrames.push(frameData);
                addFrameToGallery(frameData);
                resolve();
            }, `image/${currentFormat}`, quality);
        };
    });
}

// 진행률 업데이트
function updateProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    document.getElementById('progressPercent').textContent = `${percent}%`;
    document.getElementById('progressFill').style.width = `${percent}%`;
}

// 추출 취소
function cancelExtraction() {
    isExtracting = false;
    elements.progressCard.style.display = 'none';
    showToast('프레임 추출이 취소되었습니다.');
}

// 프레임을 갤러리에 추가
function addFrameToGallery(frameData) {
    const frameItem = document.createElement('div');
    frameItem.className = 'frame-item';
    frameItem.dataset.frameId = frameData.id;

    frameItem.innerHTML = `
        <img src="${frameData.url}" alt="Frame at ${formatTime(frameData.time)}">
        <div class="frame-checkbox ${selectedFrames.has(frameData.id) ? 'checked' : ''}"></div>
        <div class="frame-time">${formatTime(frameData.time)}</div>
        <div class="frame-actions">
            <button class="download-btn" title="다운로드">
                <i data-lucide="download" class="w-3 h-3"></i>
            </button>
            <button class="delete-btn" title="삭제">
                <i data-lucide="trash-2" class="w-3 h-3"></i>
            </button>
        </div>
    `;

    // 이벤트 리스너 추가
    frameItem.addEventListener('click', (e) => {
        if (!e.target.closest('.frame-actions') && !e.target.closest('.frame-checkbox')) {
            // 이미지 클릭 시 라이트박스 열기
            openLightbox(frameData);
        }
    });

    // 체크박스 클릭
    const checkbox = frameItem.querySelector('.frame-checkbox');
    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFrameSelection(frameData.id);
    });

    frameItem.querySelector('.download-btn').addEventListener('click', () => {
        downloadFrame(frameData);
    });

    frameItem.querySelector('.delete-btn').addEventListener('click', () => {
        deleteFrame(frameData.id);
    });

    elements.frameGrid.appendChild(frameItem);
    updateGalleryDisplay();
    updateFrameCount();

    // Lucide 아이콘 재초기화
    lucide.createIcons();
}

// 프레임 선택 토글
function toggleFrameSelection(frameId) {
    const frameItem = document.querySelector(`[data-frame-id="${frameId}"]`);
    const checkbox = frameItem.querySelector('.frame-checkbox');

    if (selectedFrames.has(frameId)) {
        selectedFrames.delete(frameId);
        frameItem.classList.remove('selected');
        checkbox.classList.remove('checked');
    } else {
        selectedFrames.add(frameId);
        frameItem.classList.add('selected');
        checkbox.classList.add('checked');
    }
}

// 프레임 다운로드
function downloadFrame(frameData) {
    const link = document.createElement('a');
    link.href = frameData.url;
    link.download = `frame_${formatTime(frameData.time).replace(/:/g, '-')}.${currentFormat}`;
    link.click();
}

// 프레임 삭제
function deleteFrame(frameId) {
    const index = extractedFrames.findIndex(f => f.id === frameId);
    if (index > -1) {
        URL.revokeObjectURL(extractedFrames[index].url);
        extractedFrames.splice(index, 1);
    }

    const frameItem = document.querySelector(`[data-frame-id="${frameId}"]`);
    if (frameItem) {
        frameItem.remove();
    }

    selectedFrames.delete(frameId);
    updateFrameCount();

    if (extractedFrames.length === 0) {
        updateGalleryDisplay();
    }
}

// 전체 선택
function selectAllFrames() {
    const allFrameItems = document.querySelectorAll('.frame-item');

    if (selectedFrames.size === extractedFrames.length) {
        // 모두 해제
        selectedFrames.clear();
        allFrameItems.forEach(item => {
            item.classList.remove('selected');
            item.querySelector('.frame-checkbox').classList.remove('checked');
        });
    } else {
        // 모두 선택
        extractedFrames.forEach(frame => {
            selectedFrames.add(frame.id);
        });
        allFrameItems.forEach(item => {
            item.classList.add('selected');
            item.querySelector('.frame-checkbox').classList.add('checked');
        });
    }
}

// 선택된 프레임 삭제
function deleteSelectedFrames() {
    const toDelete = Array.from(selectedFrames);
    toDelete.forEach(frameId => {
        deleteFrame(frameId);
    });
    showToast(`${toDelete.length}개의 프레임이 삭제되었습니다.`);
}

// 전체 다운로드
async function downloadAllFrames() {
    if (extractedFrames.length === 0) {
        showToast('다운로드할 프레임이 없습니다.');
        return;
    }

    for (let frame of extractedFrames) {
        downloadFrame(frame);
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    showToast(`${extractedFrames.length}개의 프레임 다운로드 완료`);
}

// 프레임 수 업데이트
function updateFrameCount() {
    document.getElementById('frameCount').textContent = extractedFrames.length;
}

// 갤러리 표시 업데이트
function updateGalleryDisplay() {
    if (extractedFrames.length === 0) {
        if (elements.emptyGallery) elements.emptyGallery.style.display = 'flex';
        if (elements.frameGrid) elements.frameGrid.style.display = 'none';
    } else {
        if (elements.emptyGallery) elements.emptyGallery.style.display = 'none';
        if (elements.frameGrid) elements.frameGrid.style.display = 'grid';
    }
}

// URL 처리 함수들
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}

async function processVideoUrl(url) {
    if (url.includes('dropbox.com')) {
        return processDropboxUrl(url);
    }
    if (url.includes('drive.google.com')) {
        return processGoogleDriveUrl(url);
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        throw new Error('YouTube 비디오는 직접 추출이 제한됩니다.');
    }
    if (url.includes('vimeo.com')) {
        throw new Error('Vimeo 비디오는 직접 추출이 제한됩니다.');
    }
    if (isDirectVideoUrl(url)) {
        return url;
    }
    return useProxyServer(url);
}

function processDropboxUrl(url) {
    let directUrl = url;
    if (url.includes('www.dropbox.com')) {
        directUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        directUrl = directUrl.replace(/[?&]dl=0/, '');
    } else if (url.includes('dl=0')) {
        directUrl = url.replace('dl=0', 'raw=1');
    } else if (!url.includes('dl=1') && !url.includes('raw=1')) {
        directUrl += (url.includes('?') ? '&' : '?') + 'raw=1';
    }
    return directUrl;
}

function processGoogleDriveUrl(url) {
    let fileId = null;
    const patterns = [
        /\/file\/d\/([a-zA-Z0-9-_]+)/,
        /id=([a-zA-Z0-9-_]+)/,
        /\/open\?id=([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            fileId = match[1];
            break;
        }
    }

    if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
}

function isDirectVideoUrl(url) {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
    const urlLower = url.toLowerCase();
    return videoExtensions.some(ext => urlLower.includes(ext));
}

function useProxyServer(url) {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    showToast('CORS 우회를 위해 프록시 서버를 사용합니다.');
    return proxyUrl;
}

function getFileNameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const fileName = pathname.split('/').pop() || 'video';
        return fileName.split('?')[0];
    } catch (_) {
        return 'video';
    }
}

// 유틸리티 함수
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

function resetAll() {
    // 비디오 초기화
    if (video && video.src) {
        video.pause();
        video.src = '';
    }

    // 프레임 데이터 초기화
    extractedFrames.forEach(frame => {
        URL.revokeObjectURL(frame.url);
    });
    extractedFrames = [];
    selectedFrames.clear();

    // UI 초기화
    resetVideoInterface();
    elements.frameGrid.innerHTML = '';
    updateGalleryDisplay();
    updateFrameCount();

    // 입력 초기화
    elements.videoInput.value = '';
    elements.urlInput.value = '';

    showToast('초기화되었습니다.');
}

// 라이트박스 이벤트 설정
function setupLightboxEvents() {
    // 닫기 버튼
    elements.lightboxClose.addEventListener('click', closeLightbox);

    // 배경 클릭으로 닫기
    elements.lightbox.addEventListener('click', (e) => {
        if (e.target === elements.lightbox) {
            closeLightbox();
        }
    });

    // 이전/다음 버튼
    elements.lightboxPrev.addEventListener('click', showPrevImage);
    elements.lightboxNext.addEventListener('click', showNextImage);

    // 다운로드 버튼
    elements.lightboxDownload.addEventListener('click', () => {
        if (currentLightboxIndex >= 0 && currentLightboxIndex < extractedFrames.length) {
            downloadFrame(extractedFrames[currentLightboxIndex]);
        }
    });

    // 키보드 이벤트
    document.addEventListener('keydown', (e) => {
        if (!elements.lightbox.classList.contains('show')) return;

        switch(e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                showPrevImage();
                break;
            case 'ArrowRight':
                showNextImage();
                break;
        }
    });
}

// 라이트박스 열기
function openLightbox(frameData) {
    const index = extractedFrames.findIndex(f => f.id === frameData.id);
    if (index === -1) return;

    currentLightboxIndex = index;
    updateLightboxContent();
    elements.lightbox.classList.add('show');
    lucide.createIcons();
}

// 라이트박스 닫기
function closeLightbox() {
    elements.lightbox.classList.remove('show');
    currentLightboxIndex = -1;
}

// 라이트박스 콘텐츠 업데이트
function updateLightboxContent() {
    if (currentLightboxIndex < 0 || currentLightboxIndex >= extractedFrames.length) return;

    const frameData = extractedFrames[currentLightboxIndex];
    elements.lightboxImage.src = frameData.url;
    elements.lightboxTime.textContent = `프레임 시간: ${formatTime(frameData.time)}`;

    // 이전/다음 버튼 상태 업데이트
    elements.lightboxPrev.disabled = currentLightboxIndex === 0;
    elements.lightboxNext.disabled = currentLightboxIndex === extractedFrames.length - 1;
}

// 이전 이미지 표시
function showPrevImage() {
    if (currentLightboxIndex > 0) {
        currentLightboxIndex--;
        updateLightboxContent();
    }
}

// 다음 이미지 표시
function showNextImage() {
    if (currentLightboxIndex < extractedFrames.length - 1) {
        currentLightboxIndex++;
        updateLightboxContent();
    }
}