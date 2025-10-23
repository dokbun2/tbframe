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

// DOM 요소
const uploadArea = document.getElementById('uploadArea');
const videoInput = document.getElementById('videoInput');
const videoContainer = document.getElementById('videoContainer');
const videoPlayer = document.getElementById('videoPlayer');
const frameCanvas = document.getElementById('frameCanvas');
const controlPanel = document.getElementById('controlPanel');
const progressArea = document.getElementById('progressArea');
const frameGallery = document.getElementById('frameGallery');
const frameGrid = document.getElementById('frameGrid');
const toast = document.getElementById('toast');

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    video = videoPlayer;
    canvas = frameCanvas;
    ctx = canvas.getContext('2d');

    setupEventListeners();

    // 초기 갤러리 상태 설정
    updateGalleryDisplay();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 업로드 영역 클릭 - URL 입력 영역 제외
    uploadArea.addEventListener('click', (e) => {
        // URL 입력 섹션 클릭시 파일 선택 방지
        if (!e.target.closest('.url-input-section')) {
            videoInput.click();
        }
    });

    // 파일 선택
    videoInput.addEventListener('change', handleFileSelect);

    // URL 입력 관련 이벤트
    const urlInput = document.getElementById('urlInput');
    const loadUrlBtn = document.getElementById('loadUrlBtn');

    loadUrlBtn.addEventListener('click', handleUrlLoad);

    // Enter 키로 URL 로드
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleUrlLoad();
        }
    });

    // 드래그 앤 드롭
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // 비디오 메타데이터 로드
    videoPlayer.addEventListener('loadedmetadata', () => {
        updateVideoInfo();
    });

    // 비디오 완전 로드 대기
    videoPlayer.addEventListener('loadeddata', () => {
        // 비디오가 완전히 로드되면 첫 프레임 렌더링
        video.currentTime = 0.01; // 첫 프레임으로 이동
        showToast('비디오 로드 완료');
    });

    // 간격 버튼
    document.querySelectorAll('.interval-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.interval-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentInterval = parseFloat(btn.dataset.interval);
            updateEstimatedFrames();
        });
    });

    // 포맷 버튼
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFormat = btn.dataset.format;
        });
    });

    // 업스케일링 버튼
    document.querySelectorAll('.scale-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentScale = parseInt(btn.dataset.scale);
            updateEstimatedFrames();
        });
    });

    // 추출 버튼
    document.getElementById('extractCurrentBtn').addEventListener('click', extractCurrentFrame);
    document.getElementById('extractAllBtn').addEventListener('click', extractAllFrames);

    // 취소 버튼
    document.getElementById('cancelExtractBtn').addEventListener('click', () => {
        isExtracting = false;
        showToast('프레임 추출이 취소되었습니다.');
    });

    // 갤러리 액션 버튼
    document.getElementById('selectAllBtn').addEventListener('click', selectAllFrames);
    document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedFrames);
    document.getElementById('downloadAllBtn').addEventListener('click', downloadAllFrames);

    // 닫기 버튼
    document.querySelector('.close-btn').addEventListener('click', () => {
        if (confirm('정말로 종료하시겠습니까? 추출된 프레임이 모두 삭제됩니다.')) {
            resetAll();
        }
    });
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
    const urlInput = document.getElementById('urlInput');
    const loadUrlBtn = document.getElementById('loadUrlBtn');
    const url = urlInput.value.trim();

    if (!url) {
        showToast('URL을 입력해주세요.');
        return;
    }

    // URL 유효성 검사
    if (!isValidUrl(url)) {
        showToast('올바른 URL을 입력해주세요.');
        return;
    }

    // 로딩 상태 표시
    const originalBtnText = loadUrlBtn.textContent;
    loadUrlBtn.disabled = true;
    loadUrlBtn.innerHTML = '<span class="loading-spinner"></span>로딩 중...';

    try {
        // YouTube, Vimeo 등 플랫폼 확인
        const videoUrl = await processVideoUrl(url);

        // 비디오 로드
        loadVideo(videoUrl, getFileNameFromUrl(videoUrl));

        // 입력 필드 초기화
        urlInput.value = '';

        showToast('비디오 로드 성공!');
    } catch (error) {
        console.error('URL 로드 실패:', error);

        // 에러 메시지 표시
        if (error.message) {
            showToast(error.message);
        } else {
            showToast('비디오 로드에 실패했습니다. 다른 URL을 시도해보세요.');
        }
    } finally {
        // 버튼 상태 복원
        loadUrlBtn.disabled = false;
        loadUrlBtn.textContent = originalBtnText;
    }
}

// 비디오 로드 공통 함수
function loadVideo(url, fileName = 'video') {
    videoPlayer.src = url;

    // 비디오 설정 최적화
    videoPlayer.preload = 'auto';
    videoPlayer.muted = true; // 자동재생 허용을 위해 음소거
    videoPlayer.crossOrigin = 'anonymous'; // CORS 지원

    // 에러 처리
    videoPlayer.onerror = (e) => {
        console.error('비디오 로드 오류:', e);

        const error = videoPlayer.error;
        let errorMessage = '비디오를 로드할 수 없습니다.';

        // 에러 코드별 메시지
        if (error) {
            switch (error.code) {
                case 1: // MEDIA_ERR_ABORTED
                    errorMessage = '비디오 로드가 중단되었습니다.';
                    break;
                case 2: // MEDIA_ERR_NETWORK
                    errorMessage = '네트워크 오류가 발생했습니다. URL을 확인하거나 다시 시도해주세요.';
                    break;
                case 3: // MEDIA_ERR_DECODE
                    errorMessage = '비디오 디코딩 오류가 발생했습니다. 지원되지 않는 형식일 수 있습니다.';
                    break;
                case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                    errorMessage = '지원되지 않는 비디오 형식입니다. MP4, WebM, OGG 형식을 사용해주세요.';
                    break;
            }
        }

        // CORS 에러 가능성 체크
        if (url.startsWith('http') && !url.startsWith(window.location.origin)) {
            errorMessage += '\n\nCORS 정책으로 인한 오류일 수 있습니다. 다음 방법을 시도해보세요:\n';
            errorMessage += '1. 비디오 파일의 직접 URL 사용 (.mp4, .webm 등)\n';
            errorMessage += '2. 파일을 직접 업로드\n';
            errorMessage += '3. CORS가 허용된 서버의 비디오 사용';
        }

        showToast(errorMessage);

        // UI 원래대로 복원
        uploadArea.classList.remove('video-loaded');
        videoContainer.style.display = 'none';
        controlPanel.style.display = 'none';

        // 입력 필드 초기화
        const urlInput = document.getElementById('urlInput');
        if (urlInput) urlInput.value = '';
    };

    // UI 업데이트 - 새로운 레이아웃에서는 숨기지 않고 컨테이너 변경
    uploadArea.classList.add('video-loaded');
    videoContainer.style.display = 'block';
    controlPanel.style.display = 'block';

    showToast('비디오 로드 중...');
}

// URL 유효성 검사
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
        return false;
    }
}

// 비디오 URL 처리 (YouTube, Vimeo, Dropbox 등)
async function processVideoUrl(url) {
    // Dropbox URL 처리
    if (url.includes('dropbox.com')) {
        return processDropboxUrl(url);
    }

    // Google Drive URL 처리
    if (url.includes('drive.google.com')) {
        return processGoogleDriveUrl(url);
    }

    // YouTube URL 처리
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return extractYouTubeDirectUrl(url);
    }

    // Vimeo URL 처리
    if (url.includes('vimeo.com')) {
        return extractVimeoDirectUrl(url);
    }

    // 직접 비디오 파일 URL
    if (isDirectVideoUrl(url)) {
        return url;
    }

    // 프록시 서버 사용 (CORS 우회)
    return useProxyServer(url);
}

// Dropbox URL 처리
function processDropboxUrl(url) {
    // Dropbox 공유 링크를 직접 다운로드 링크로 변환
    let directUrl = url;

    // www.dropbox.com을 dl.dropboxusercontent.com으로 변경
    if (url.includes('www.dropbox.com')) {
        directUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        // dl=0 파라미터 제거
        directUrl = directUrl.replace(/[?&]dl=0/, '');
    }
    // 또는 dl=0을 raw=1로 변경
    else if (url.includes('dl=0')) {
        directUrl = url.replace('dl=0', 'raw=1');
    }
    // 이미 dl=1이 있으면 그대로 사용
    else if (!url.includes('dl=1') && !url.includes('raw=1')) {
        // raw=1 파라미터 추가
        directUrl += (url.includes('?') ? '&' : '?') + 'raw=1';
    }

    console.log('Dropbox URL 변환:', directUrl);
    showToast('Dropbox 비디오를 로드합니다...');

    // CORS 문제를 피하기 위해 프록시 사용 고려
    // Dropbox도 CORS 제한이 있을 수 있음
    if (!directUrl.includes('dl.dropboxusercontent.com')) {
        console.log('Dropbox CORS 우회를 위해 프록시 사용');
        return useProxyServer(directUrl);
    }

    return directUrl;
}

// Google Drive URL 처리
function processGoogleDriveUrl(url) {
    // Google Drive 파일 ID 추출
    let fileId = null;

    // 다양한 Google Drive URL 형식 처리
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
        // Google Drive 직접 다운로드 URL로 변환
        const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        console.log('Google Drive URL 변환:', directUrl);
        showToast('Google Drive 비디오를 로드합니다...');
        return directUrl;
    }

    return url;
}

// YouTube 직접 URL 추출 (제한적)
function extractYouTubeDirectUrl(url) {
    const videoId = extractYouTubeId(url);
    if (videoId) {
        // YouTube는 직접 비디오 파일 접근이 매우 제한적
        // 대안 제시
        const message = `YouTube 비디오는 저작권 보호로 직접 추출이 제한됩니다.\n\n` +
                       `대안:\n` +
                       `1. YouTube 다운로더 서비스 이용 (y2mate, savefrom 등)\n` +
                       `2. 다운로드한 파일을 업로드\n` +
                       `3. 화면 녹화 도구 사용\n\n` +
                       `비디오 ID: ${videoId}`;
        throw new Error(message);
    }
    return url;
}

// YouTube ID 추출
function extractYouTubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Vimeo 직접 URL 추출 (제한적)
function extractVimeoDirectUrl(url) {
    // Vimeo도 직접 접근이 제한됨
    throw new Error('Vimeo 비디오는 직접 다운로드가 제한됩니다. 비디오 파일의 직접 URL을 사용해주세요.');
}

// 직접 비디오 URL인지 확인
function isDirectVideoUrl(url) {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
    const urlLower = url.toLowerCase();
    return videoExtensions.some(ext => urlLower.includes(ext));
}

// 프록시 서버 사용 (CORS 우회)
function useProxyServer(url) {
    // 로컬 프록시 서버 확인 (개발 환경)
    const localProxy = `http://localhost:3001/proxy?url=${encodeURIComponent(url)}`;

    // 로컬 프록시 서버가 실행 중인지 확인
    fetch(localProxy, { method: 'HEAD' })
        .then(() => {
            console.log('로컬 프록시 서버 사용:', localProxy);
            return localProxy;
        })
        .catch(() => {
            // 로컬 프록시가 없으면 공개 프록시 사용
            // cors-anywhere는 제한이 있으므로 allorigins 사용
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            console.warn('공개 프록시 서버 사용:', proxyUrl);
            showToast('CORS 우회를 위해 프록시 서버를 사용합니다. 로딩이 느릴 수 있습니다.');
            return proxyUrl;
        });

    // 기본적으로 allorigins 프록시 사용
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    console.warn('프록시 서버를 통한 접근:', proxyUrl);
    showToast('CORS 우회를 위해 프록시 서버를 사용합니다.');

    return proxyUrl;
}

// URL에서 파일명 추출
function getFileNameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const fileName = pathname.split('/').pop() || 'video';
        return fileName.split('?')[0]; // 쿼리 파라미터 제거
    } catch (_) {
        return 'video';
    }
}

// 비디오 정보 업데이트
function updateVideoInfo() {
    const duration = video.duration;
    document.getElementById('videoDuration').textContent = formatTime(duration);
    updateEstimatedFrames();

    // 기본 캔버스 크기 설정 (업스케일링은 추출 시 적용)
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 캔버스 렌더링 품질 설정
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
}

// 예상 프레임 수 계산
function updateEstimatedFrames() {
    if (!video || !video.duration) return;

    const frameCount = Math.floor(video.duration / currentInterval);
    document.getElementById('estimatedFrames').textContent = `${frameCount}개`;
}

// 현재 프레임 추출
function extractCurrentFrame() {
    if (!video || !video.src) {
        showToast('먼저 비디오를 업로드하세요.');
        return;
    }

    // 비디오가 로드되지 않았거나 재생 시간이 0인 경우
    if (video.readyState < 2) {
        showToast('비디오가 아직 로드 중입니다. 잠시 후 다시 시도하세요.');
        return;
    }

    // 업스케일링을 위한 캔버스 크기 설정
    const scaledWidth = video.videoWidth * currentScale;
    const scaledHeight = video.videoHeight * currentScale;

    // 임시 캔버스 생성 (업스케일링용)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // 고화질 렌더링을 위한 설정
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';

    // 업스케일링된 크기로 비디오 그리기
    tempCtx.drawImage(video, 0, 0, scaledWidth, scaledHeight);

    // 최고 품질로 고정 (PNG는 무손실, JPEG/WebP는 95%)
    const quality = currentFormat === 'png' ? 1.0 : 0.95;

    tempCanvas.toBlob((blob) => {
        if (!blob) {
            showToast('프레임 추출에 실패했습니다.');
            return;
        }

        const frame = {
            id: Date.now(),
            time: video.currentTime,
            blob: blob,
            url: URL.createObjectURL(blob),
            width: scaledWidth,
            height: scaledHeight,
            scale: currentScale
        };

        addFrameToGallery(frame);
        extractedFrames.push(frame);
        updateFrameCount();
        showToast(`프레임 추출 완료 (${currentScale}배 업스케일링)`);
    }, `image/${currentFormat}`, quality);
}

// 전체 프레임 추출
async function extractAllFrames() {
    if (!video || !video.src || isExtracting) {
        showToast('먼저 비디오를 업로드하세요.');
        return;
    }

    if (video.readyState < 2) {
        showToast('비디오가 아직 로드 중입니다. 잠시 후 다시 시도하세요.');
        return;
    }

    isExtracting = true;
    extractedFrames = [];
    selectedFrames.clear();
    frameGrid.innerHTML = '';

    // UI 업데이트
    progressArea.style.display = 'block';
    // 새로운 레이아웃에서는 갤러리는 항상 표시됨
    updateGalleryDisplay();

    const duration = video.duration;
    const totalFrames = Math.floor(duration / currentInterval);
    let extractedCount = 0;

    // 진행률 업데이트
    document.getElementById('totalFrames').textContent = totalFrames;
    document.getElementById('currentFrame').textContent = '0';
    document.getElementById('progressPercent').textContent = '0';
    document.getElementById('progressFill').style.width = '0%';

    showToast(`프레임 추출 시작 (총 ${totalFrames}개)`);

    // 비디오를 처음부터 시작
    video.currentTime = 0;

    const extractNextFrame = () => {
        if (video.currentTime >= duration || !isExtracting || extractedCount >= totalFrames) {
            // 추출 완료
            isExtracting = false;
            progressArea.style.display = 'none';

            if (extractedFrames.length > 0) {
                showToast(`${extractedFrames.length}개의 프레임 추출 완료`);
            }
            return;
        }

        // seeked 이벤트 리스너 추가
        const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);

            // 업스케일링을 위한 캔버스 크기 설정
            const scaledWidth = video.videoWidth * currentScale;
            const scaledHeight = video.videoHeight * currentScale;

            // 임시 캔버스 생성 (업스케일링용)
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = scaledWidth;
            tempCanvas.height = scaledHeight;
            const tempCtx = tempCanvas.getContext('2d');

            // 고화질 렌더링을 위한 설정
            tempCtx.imageSmoothingEnabled = true;
            tempCtx.imageSmoothingQuality = 'high';

            // 업스케일링된 크기로 비디오 그리기
            tempCtx.drawImage(video, 0, 0, scaledWidth, scaledHeight);

            // 최고 품질로 고정 (PNG는 무손실, JPEG/WebP는 95%)
            const quality = currentFormat === 'png' ? 1.0 : 0.95;

            tempCanvas.toBlob((blob) => {
                if (blob) {
                    const frame = {
                        id: Date.now() + extractedCount,
                        time: video.currentTime,
                        blob: blob,
                        url: URL.createObjectURL(blob),
                        width: scaledWidth,
                        height: scaledHeight,
                        scale: currentScale
                    };

                    addFrameToGallery(frame);
                    extractedFrames.push(frame);
                    extractedCount++;

                    // 진행률 업데이트
                    const progress = (extractedCount / totalFrames) * 100;
                    document.getElementById('progressPercent').textContent = Math.round(progress);
                    document.getElementById('progressFill').style.width = `${progress}%`;
                    document.getElementById('currentFrame').textContent = extractedCount;
                }

                // 다음 프레임으로 이동
                const nextTime = video.currentTime + currentInterval;
                if (nextTime < duration && isExtracting) {
                    video.currentTime = nextTime;
                    // 재귀적으로 다음 프레임 추출
                    setTimeout(extractNextFrame, 10);
                } else {
                    // 추출 완료
                    isExtracting = false;
                    progressArea.style.display = 'none';

                    if (extractedFrames.length > 0) {
                        showToast(`${extractedFrames.length}개의 프레임 추출 완료`);
                    }
                }
            }, `image/${currentFormat}`, quality);
        };

        video.addEventListener('seeked', onSeeked);

        // 현재 위치가 이미 원하는 위치라면 바로 추출
        if (Math.abs(video.currentTime - extractedCount * currentInterval) < 0.01) {
            onSeeked();
        } else {
            video.currentTime = extractedCount * currentInterval;
        }
    };

    // 추출 시작
    extractNextFrame();
}

// 프레임을 갤러리에 추가
function addFrameToGallery(frame) {
    const frameItem = document.createElement('div');
    frameItem.className = 'frame-item';
    frameItem.dataset.frameId = frame.id;

    const scaleInfo = frame.scale && frame.scale > 1 ? ` (${frame.scale}x)` : '';
    frameItem.innerHTML = `
        <input type="checkbox" class="frame-checkbox">
        <img src="${frame.url}" alt="Frame at ${formatTime(frame.time)}">
        <div class="frame-info">${formatTime(frame.time)}${scaleInfo}</div>
        <div class="frame-actions">
            <button class="frame-btn download-btn" title="다운로드">⬇</button>
            <button class="frame-btn delete-btn" title="삭제">🗑</button>
        </div>
    `;

    // 이벤트 리스너
    frameItem.addEventListener('click', (e) => {
        if (e.target.closest('.frame-actions')) return;

        frameItem.classList.toggle('selected');
        const checkbox = frameItem.querySelector('.frame-checkbox');
        checkbox.checked = !checkbox.checked;

        if (checkbox.checked) {
            selectedFrames.add(frame.id);
        } else {
            selectedFrames.delete(frame.id);
        }
    });

    // 다운로드 버튼
    const downloadBtn = frameItem.querySelector('.download-btn');
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadFrame(frame);
    });

    // 삭제 버튼
    const deleteBtn = frameItem.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFrame(frame.id);
    });

    frameGrid.appendChild(frameItem);

    // 새로운 레이아웃에서는 갤러리는 항상 표시됨
    updateGalleryDisplay();

    updateFrameCount();
}

// 프레임 다운로드
function downloadFrame(frame) {
    const link = document.createElement('a');
    link.href = frame.url;
    const scaleInfo = frame.scale && frame.scale > 1 ? `_${frame.scale}x` : '';
    const resolution = frame.width && frame.height ? `_${frame.width}x${frame.height}` : '';
    link.download = `frame_${formatTime(frame.time).replace(/:/g, '-')}${scaleInfo}${resolution}.${currentFormat}`;
    link.click();
}

// 프레임 삭제
function deleteFrame(frameId) {
    const frameItem = document.querySelector(`[data-frame-id="${frameId}"]`);
    if (frameItem) {
        frameItem.remove();
    }

    const frameIndex = extractedFrames.findIndex(f => f.id === frameId);
    if (frameIndex !== -1) {
        URL.revokeObjectURL(extractedFrames[frameIndex].url);
        extractedFrames.splice(frameIndex, 1);
    }

    selectedFrames.delete(frameId);
    updateFrameCount();

    if (extractedFrames.length === 0) {
        updateGalleryDisplay();
    }
}

// 전체 프레임 선택
function selectAllFrames() {
    const allFrameItems = document.querySelectorAll('.frame-item');
    const allSelected = selectedFrames.size === extractedFrames.length;

    allFrameItems.forEach(item => {
        const checkbox = item.querySelector('.frame-checkbox');
        const frameId = parseInt(item.dataset.frameId);

        if (allSelected) {
            item.classList.remove('selected');
            checkbox.checked = false;
            selectedFrames.delete(frameId);
        } else {
            item.classList.add('selected');
            checkbox.checked = true;
            selectedFrames.add(frameId);
        }
    });

    // 버튼 텍스트 업데이트
    document.getElementById('selectAllBtn').textContent =
        allSelected ? '전체 선택' : '선택 해제';
}

// 선택된 프레임 삭제
function deleteSelectedFrames() {
    if (selectedFrames.size === 0) {
        showToast('삭제할 프레임을 선택하세요.');
        return;
    }

    if (!confirm(`${selectedFrames.size}개의 프레임을 삭제하시겠습니까?`)) {
        return;
    }

    selectedFrames.forEach(frameId => {
        deleteFrame(frameId);
    });

    selectedFrames.clear();
    showToast('선택된 프레임이 삭제되었습니다.');
}

// 모든 프레임 다운로드
async function downloadAllFrames() {
    if (extractedFrames.length === 0) {
        showToast('다운로드할 프레임이 없습니다.');
        return;
    }

    showToast('다운로드 준비 중...');

    // ZIP 파일 생성을 위한 준비 (실제 구현시 JSZip 라이브러리 사용)
    // 여기서는 각 파일을 순차적으로 다운로드
    for (let i = 0; i < extractedFrames.length; i++) {
        const frame = extractedFrames[i];
        const link = document.createElement('a');
        link.href = frame.url;
        const scaleInfo = frame.scale && frame.scale > 1 ? `_${frame.scale}x` : '';
        const resolution = frame.width && frame.height ? `_${frame.width}x${frame.height}` : '';
        link.download = `frame_${String(i + 1).padStart(4, '0')}_${formatTime(frame.time).replace(/:/g, '-')}${scaleInfo}${resolution}.${currentFormat}`;
        link.click();

        // 다운로드 간격을 두어 브라우저 부하 방지
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
    const emptyGallery = document.getElementById('emptyGallery');
    const frameGrid = document.getElementById('frameGrid');

    if (extractedFrames.length === 0) {
        // 프레임이 없을 때
        if (emptyGallery) emptyGallery.style.display = 'flex';
        if (frameGrid) frameGrid.style.display = 'none';
    } else {
        // 프레임이 있을 때
        if (emptyGallery) emptyGallery.style.display = 'none';
        if (frameGrid) frameGrid.style.display = 'grid';
    }
}

// 시간 포맷팅
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${minutes}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// 토스트 메시지 표시
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 전체 초기화
function resetAll() {
    // 추출 중지
    isExtracting = false;

    // URL 정리
    extractedFrames.forEach(frame => {
        URL.revokeObjectURL(frame.url);
    });

    if (videoPlayer.src) {
        URL.revokeObjectURL(videoPlayer.src);
    }

    // 변수 초기화
    extractedFrames = [];
    selectedFrames.clear();

    // UI 초기화
    uploadArea.style.display = 'block';
    videoContainer.style.display = 'none';
    controlPanel.style.display = 'none';
    progressArea.style.display = 'none';
    updateGalleryDisplay();
    frameGrid.innerHTML = '';

    // 입력 초기화
    videoInput.value = '';
    videoPlayer.src = '';

    // 기본값 복원
    currentInterval = 0.1;
    currentFormat = 'png';
    currentScale = 1;

    document.querySelectorAll('.interval-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.interval === '0.1') {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.format === 'png') {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.scale-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.scale === '1') {
            btn.classList.add('active');
        }
    });
}

// 페이지 언로드 시 URL 정리
window.addEventListener('beforeunload', () => {
    extractedFrames.forEach(frame => {
        URL.revokeObjectURL(frame.url);
    });

    if (videoPlayer.src) {
        URL.revokeObjectURL(videoPlayer.src);
    }
});