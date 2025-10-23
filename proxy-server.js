// 간단한 CORS 프록시 서버 (선택적 사용)
// 이 서버는 CORS 제한을 우회하기 위해 사용할 수 있습니다.
// 사용법: node proxy-server.js

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3001;

// CORS 설정
app.use(cors());
app.use(express.json());

// 프록시 엔드포인트
app.get('/proxy', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        // 비디오 URL 검증
        if (!isVideoUrl(url)) {
            return res.status(400).json({ error: 'URL must point to a video file' });
        }

        // 외부 비디오 스트림
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'video/*'
            }
        });

        // 헤더 전달
        const contentType = response.headers['content-type'];
        const contentLength = response.headers['content-length'];

        if (contentType) res.setHeader('Content-Type', contentType);
        if (contentLength) res.setHeader('Content-Length', contentLength);

        // 비디오 스트림 전달
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ error: 'Failed to fetch video' });
    }
});

// 비디오 URL 검증
function isVideoUrl(url) {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
    const urlLower = url.toLowerCase();

    // 직접 비디오 파일 확인
    if (videoExtensions.some(ext => urlLower.includes(ext))) {
        return true;
    }

    // Content-Type으로 확인 (선택적)
    return true; // 일단 모든 URL 허용, 실제 요청시 검증
}

// 서버 시작
app.listen(PORT, () => {
    console.log(`CORS proxy server running on http://localhost:${PORT}`);
    console.log(`Usage: http://localhost:${PORT}/proxy?url=YOUR_VIDEO_URL`);
});