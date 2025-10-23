# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

툴비프레임(Toolbeeframe) is a web-based video frame extraction tool that allows users to extract frames from videos at specific intervals. The project is built with vanilla JavaScript, HTML5 Canvas API, and includes a Node.js proxy server for handling CORS issues with external video URLs.

## Commands

### Development
```bash
# Install dependencies (required for proxy server)
npm install

# Run development server
npm run dev

# Run CORS proxy server (separate terminal, for external URLs)
npm run proxy

# Open directly in browser (no server required for local files)
npm start
```

## Architecture

### Core Components

1. **Frontend (Single-Page Application)**
   - `index.html`: Main HTML structure with video player and UI components
   - `script.js`: Core logic for video processing and frame extraction
   - `styles.css`: UI styling with responsive design

2. **Video Input Methods**
   - Local file upload (drag-and-drop or click)
   - URL input with automatic platform detection
   - Platform-specific URL processors for Dropbox, Google Drive

3. **Frame Extraction Engine**
   - Uses HTML5 Canvas API for frame capture
   - Supports multiple intervals (0.1s, 0.5s, 1s, 2s)
   - Image format conversion (PNG, JPG, WebP)
   - Upscaling capability (1x, 2x, 4x resolution)

4. **CORS Proxy Server** (`proxy-server.js`)
   - Express.js server for bypassing CORS restrictions
   - Streams video content from external URLs
   - Runs on port 3001 by default

### Key Functions in script.js

- `handleUrlLoad()`: Processes URL input, detects platform, and loads video
- `processVideoUrl()`: Routes URLs to platform-specific processors
- `processDropboxUrl()`: Converts Dropbox share links to direct URLs (dl=0 → raw=1)
- `processGoogleDriveUrl()`: Extracts file ID and creates download URL
- `extractFrames()`: Core frame extraction logic with progress tracking
- `loadVideo()`: Common video loading with error handling and CORS support

### URL Processing Flow
1. User inputs URL → `handleUrlLoad()`
2. URL validation → `isValidUrl()`
3. Platform detection → `processVideoUrl()`
4. Platform-specific conversion (Dropbox/Google Drive)
5. Direct video URLs pass through
6. CORS fallback → `useProxyServer()`

### Platform Support

- **Supported**: Direct video URLs (.mp4, .webm, etc.), Dropbox, Google Drive
- **Limited**: YouTube, Vimeo (copyright restrictions - shows user-friendly alternatives)

### Error Handling

The application provides specific error messages for:
- CORS issues (suggests proxy server or alternative methods)
- Unsupported video formats
- Network errors
- Platform-specific restrictions

## Important Notes

- YouTube/Vimeo direct extraction is intentionally blocked due to copyright protection
- The proxy server is optional but recommended for external URLs with CORS restrictions
- All frame processing happens client-side using Canvas API
- Upscaling uses high-quality image smoothing algorithms