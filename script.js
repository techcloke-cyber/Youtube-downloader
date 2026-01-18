document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const pasteBtn = document.getElementById('pasteBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const formatOptions = document.querySelectorAll('.format-option');
    const progressSection = document.querySelector('.progress-section');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const downloadDetails = document.getElementById('downloadDetails');
    const downloadSpeed = document.getElementById('downloadSpeed');
    const timeRemaining = document.getElementById('timeRemaining');
    const cancelBtn = document.getElementById('cancelBtn');
    const downloadHistory = document.getElementById('downloadHistory');
    const clearHistoryBtn = document.getElementById('clearHistory');
    const videoInfoModal = document.getElementById('videoInfoModal');
    const closeModal = document.querySelector('.close-modal');

    // Current state
    let currentFormat = 'mp4';
    let downloadInProgress = false;
    let downloadCanceled = false;

    // Initialize
    loadDownloadHistory();

    // Event Listeners
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            urlInput.value = text;
            
            // Auto-detect if it's a playlist
            if (text.includes('list=') || text.includes('/playlist')) {
                setActiveFormat('playlist');
            }
            
            // Show video info if it's a valid YouTube URL
            if (isValidYouTubeUrl(text)) {
                showVideoInfo(text);
            }
        } catch (err) {
            console.error('Failed to paste:', err);
            alert('Unable to paste from clipboard. Please paste manually.');
        }
    });

    // Format selection
    formatOptions.forEach(option => {
        option.addEventListener('click', () => {
            const format = option.dataset.format;
            setActiveFormat(format);
        });
    });

    // Download button
    downloadBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        
        if (!url) {
            alert('Please enter a YouTube URL');
            return;
        }
        
        if (!isValidYouTubeUrl(url)) {
            alert('Please enter a valid YouTube URL');
            return;
        }
        
        startDownload(url);
    });

    // Cancel download
    cancelBtn.addEventListener('click', () => {
        downloadCanceled = true;
        updateProgress(0, 'Download canceled');
        setTimeout(() => {
            progressSection.style.display = 'none';
            downloadInProgress = false;
        }, 1000);
    });

    // Clear history
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Clear all download history?')) {
            localStorage.removeItem('downloadHistory');
            loadDownloadHistory();
        }
    });

    // Modal close
    closeModal.addEventListener('click', () => {
        videoInfoModal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === videoInfoModal) {
            videoInfoModal.style.display = 'none';
        }
    });

    // Functions
    function setActiveFormat(format) {
        formatOptions.forEach(option => {
            if (option.dataset.format === format) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
        currentFormat = format;
    }

    function isValidYouTubeUrl(url) {
        const patterns = [
            /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+/,
            /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
            /^https?:\/\/youtu\.be\/[\w-]+/,
            /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[\w-]+/
        ];
        return patterns.some(pattern => pattern.test(url));
    }

    async function startDownload(url) {
        if (downloadInProgress) {
            alert('A download is already in progress');
            return;
        }

        downloadInProgress = true;
        downloadCanceled = false;
        
        // Show progress section
        progressSection.style.display = 'block';
        updateProgress(0, 'Starting download...');

        try {
            // Get selected quality
            let quality = '720';
            if (currentFormat === 'mp4') {
                quality = document.getElementById('videoQuality').value;
            } else if (currentFormat === 'mp3') {
                quality = document.getElementById('audioQuality').value;
            } else if (currentFormat === 'playlist') {
                quality = document.getElementById('playlistQuality').value;
            }

            // Get advanced options
            const includeSubtitles = document.getElementById('subtitles').checked;
            const includeMetadata = document.getElementById('metadata').checked;
            const includeThumbnail = document.getElementById('thumbnail').checked;

            // Simulate download progress (in real app, this would connect to backend)
            simulateDownloadProgress(url, quality);

        } catch (error) {
            console.error('Download error:', error);
            updateProgress(0, `Error: ${error.message}`);
            addToHistory(url, 'failed', error.message);
            downloadInProgress = false;
            
            setTimeout(() => {
                progressSection.style.display = 'none';
            }, 3000);
        }
    }

    function simulateDownloadProgress(url, quality) {
        let progress = 0;
        let speed = '1.5 MB/s';
        let eta = '00:45';
        
        const interval = setInterval(() => {
            if (downloadCanceled) {
                clearInterval(interval);
                return;
            }
            
            progress += Math.random() * 10;
            
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                
                updateProgress(progress, 'Download complete!');
                addToHistory(url, 'success', `Downloaded as ${currentFormat.toUpperCase()} (${quality})`);
                
                // Simulate file ready for download
                setTimeout(() => {
                    progressSection.style.display = 'none';
                    downloadInProgress = false;
                    
                    // In a real implementation, this would trigger actual file download
                    alert(`Download complete! Your ${currentFormat.toUpperCase()} file is ready.`);
                }, 2000);
            } else {
                updateProgress(progress, `Downloading... ${Math.floor(progress)}%`);
                
                // Update speed and ETA (simulated)
                downloadSpeed.textContent = `Speed: ${speed}`;
                timeRemaining.textContent = `ETA: ${eta}`;
                
                // Simulate changing speed
                if (Math.random() > 0.7) {
                    speed = `${(Math.random() * 2 + 0.5).toFixed(1)} MB/s`;
                    eta = `00:${Math.floor(Math.random() * 30 + 15).toString().padStart(2, '0')}`;
                }
            }
        }, 500);
    }

    function updateProgress(percent, message) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${Math.floor(percent)}%`;
        downloadDetails.textContent = message;
    }

    function addToHistory(url, status, details = '') {
        const history = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
        
        const download = {
            id: Date.now(),
            url: url,
            format: currentFormat,
            status: status,
            details: details,
            timestamp: new Date().toLocaleString(),
            filename: `video_${Date.now()}.${currentFormat}`
        };
        
        history.unshift(download);
        
        // Keep only last 20 items
        if (history.length > 20) {
            history.pop();
        }
        
        localStorage.setItem('downloadHistory', JSON.stringify(history));
        loadDownloadHistory();
    }

    function loadDownloadHistory() {
        const history = JSON.parse(localStorage.getItem('downloadHistory') || '[]');
        
        if (history.length === 0) {
            downloadHistory.innerHTML = `
                <div class="empty-history">
                    <i class="fas fa-cloud-download-alt"></i>
                    <p>No downloads yet. Paste a URL above to start!</p>
                </div>
            `;
            return;
        }
        
        downloadHistory.innerHTML = history.map(item => `
            <div class="download-item ${item.status}">
                <div class="download-info">
                    <strong>${item.filename}</strong>
                    <small>${item.timestamp}</small>
                    <div class="download-details">${item.details}</div>
                </div>
                <div class="download-status">
                    <span class="status-badge ${item.status}">
                        ${item.status === 'success' ? '✓' : '✗'} ${item.status.toUpperCase()}
                    </span>
                    <button class="retry-btn" data-url="${item.url}">
                        <i class="fas fa-redo"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add retry button listeners
        document.querySelectorAll('.retry-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = btn.dataset.url;
                urlInput.value = url;
                startDownload(url);
            });
        });
    }

    async function showVideoInfo(url) {
        // In a real implementation, this would fetch video info from backend
        const videoInfoContent = document.getElementById('videoInfoContent');
        videoInfoContent.innerHTML = `
            <div class="video-info-loading">
                <i class="fas fa-spinner fa-spin"></i> Fetching video information...
            </div>
        `;
        
        videoInfoModal.style.display = 'block';
        
        // Simulate API call
        setTimeout(() => {
            // This is mock data - real implementation would use yt-dlp or YouTube API
            const mockData = {
                title: 'Sample YouTube Video',
                duration: '5:30',
                views: '1,234,567',
                uploader: 'Sample Channel',
                uploadDate: '2023-10-01',
                description: 'This is a sample video description.',
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                formats: [
                    { quality: '1080p', format: 'MP4', size: '125 MB' },
                    { quality: '720p', format: 'MP4', size: '85 MB' },
                    { quality: '480p', format: 'MP4', size: '45 MB' },
                    { quality: 'Audio', format: 'MP3', size: '8 MB' }
                ]
            };
            
            videoInfoContent.innerHTML = `
                <div class="video-info">
                    <div class="video-thumbnail">
                        <img src="${mockData.thumbnail}" alt="Thumbnail">
                    </div>
                    <div class="video-details">
                        <h4>${mockData.title}</h4>
                        <p><strong>Channel:</strong> ${mockData.uploader}</p>
                        <p><strong>Duration:</strong> ${mockData.duration}</p>
                        <p><strong>Views:</strong> ${mockData.views}</p>
                        <p><strong>Uploaded:</strong> ${mockData.uploadDate}</p>
                    </div>
                    <div class="available-formats">
                        <h5>Available Formats:</h5>
                        ${mockData.formats.map(f => `
                            <div class="format-item">
                                <span>${f.quality} ${f.format}</span>
                                <span class="size">${f.size}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }, 1500);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+V to paste
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            if (document.activeElement !== urlInput) {
                e.preventDefault();
                pasteBtn.click();
            }
        }
        
        // Enter to download
        if (e.key === 'Enter' && document.activeElement === urlInput) {
            downloadBtn.click();
        }
    });

    // Drag and drop for URL
    urlInput.addEventListener('dragover', (e) => {
        e.preventDefault();
        urlInput.classList.add('drag-over');
    });

    urlInput.addEventListener('dragleave', () => {
        urlInput.classList.remove('drag-over');
    });

    urlInput.addEventListener('drop', (e) => {
        e.preventDefault();
        urlInput.classList.remove('drag-over');
        
        const text = e.dataTransfer.getData('text');
        if (text) {
            urlInput.value = text;
        }
    });
});
