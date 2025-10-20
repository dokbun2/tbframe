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
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 업로드 영역 클릭
    uploadArea.addEventListener('click', () => {
        videoInput.click();
    });

    // 파일 선택
    videoInput.addEventListener('change', handleFileSelect);

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
    videoPlayer.src = url;

    // 비디오 설정 최적화
    videoPlayer.preload = 'auto';
    videoPlayer.muted = true; // 자동재생 허용을 위해 음소거

    // UI 업데이트
    uploadArea.style.display = 'none';
    videoContainer.style.display = 'block';
    controlPanel.style.display = 'block';

    showToast('비디오 로드 중...');
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
    frameGallery.style.display = 'block'; // 갤러리도 바로 보여줌

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

    if (frameGallery.style.display === 'none') {
        frameGallery.style.display = 'block';
    }

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
        frameGallery.style.display = 'none';
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
    frameGallery.style.display = 'none';
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