class ScreenRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private currentStream: MediaStream | null = null;
    private currentFileSize: number = 0;
    private onFileSizeUpdate: ((size: number) => void) | null = null;

    private onRecordingStatusChange: ((status: string) => void) | null = null;

    public setOnRecordingStatusChange(callback: (status: string) => void) {
        this.onRecordingStatusChange = callback;
    }

    public setOnFileSizeUpdate(callback: (size: number) => void) {
        this.onFileSizeUpdate = callback;
    }

    public setStream(stream: MediaStream | null) {

        this.currentStream = stream;
        if (this.onRecordingStatusChange && stream) {
            this.onRecordingStatusChange('Stream is ready for recording...');
        } else if (this.onRecordingStatusChange && !stream) {
            this.onRecordingStatusChange('Waiting for stream...');
        }
    }

    public startRecording(): boolean {
        const videoTrack = this.currentStream?.getVideoTracks()[0];
        if (!videoTrack) {
            console.error('There is no video track in the MediaStream for recording.');
            this.onRecordingStatusChange?.('Error: No video track for recording.');
            return false;
        }

        const streamToRecord = new MediaStream([videoTrack]);
        const audioTrack = this.currentStream?.getAudioTracks()[0];
        if (audioTrack) {
            streamToRecord.addTrack(audioTrack);
        }

        if (!streamToRecord) {
            console.error('It is not possible to start recording: MediaStream is not available.');
            this.onRecordingStatusChange?.('Error: Stream is not available.');
            return false;
        }

        console.log(`The recording stream is active: ${streamToRecord.active}`);
        streamToRecord.getTracks().forEach(track => {
                console.log(`Track: Kind=<span class="math-inline">${track.kind}, ID=</span>${track.id}, Enabled=<span class="math-inline">${track.enabled}, ReadyState=</span>${track.readyState}`);
         });

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.warn('The recording is already in progress.');
            this.onRecordingStatusChange?.('The recording is already in progress.');
            return true;
        }

        this.recordedChunks = [];
        this.currentFileSize = 0;
        this.onRecordingStatusChange?.('Recording in progress...');
        console.log('Trying to start recording...');

        try {
            this.mediaRecorder = new MediaRecorder(streamToRecord);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log(event.data);
                    this.recordedChunks.push(event.data);
                    this.currentFileSize = this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0);
                    this.onFileSizeUpdate?.(this.currentFileSize);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('Recording stopped. Ready for download.');
                this.onRecordingStatusChange?.('Recording stopped. Ready for download.');
                this.downloadRecording();
            };

            this.mediaRecorder.onerror = (event: Event) => { 
                const error = (event as any).error;
                console.error('MediaRecorder error:', error);
                this.onRecordingStatusChange?.(`Error recording: ${error.name}`);
                alert(`Error recording: ${error.name}`);
            };

            this.mediaRecorder.start(1000); 
            console.log('Recording started successfully.');
            return true;

        } catch (e: any) {
            console.error('Cannot create MediaRecorder:', e);
            this.onRecordingStatusChange?.(`Error starting recording: ${e.message}`);
            alert(`Error starting recording: ${e.message}`);
            return false;
        }
    }

    public stopRecording(): void {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.log('Zaustavljam snimanje...');
            console.log(this.recordedChunks);
            this.onRecordingStatusChange?.('Stopping the recording...');
            this.mediaRecorder.stop();
        } else {
            console.warn('Snimanje nije aktivno ili MediaRecorder nije inicijalizovan.');
            this.onRecordingStatusChange?.('Record is not active.');
        }
    }

    public downloadRecording(): void {
        const finalMimeType = this.mediaRecorder?.mimeType || 'video/webm'; 
        const superBuffer = new Blob(this.recordedChunks, { type: finalMimeType });

        const url = URL.createObjectURL(superBuffer);
        const a = document.createElement('a');
        a.href = url;
        a.download = `udaljeni_ekran_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
        console.log('Snimak preuzet i Blob URL opozvan.');
        this.recordedChunks = [];
        this.currentFileSize = 0;
        this.onFileSizeUpdate?.(0);
        this.onRecordingStatusChange?.('The recording has been successfully downloaded.');
    }

    public getCurrentFileSize(): number {
        return this.currentFileSize;
    }

    public isRecording(): boolean {
        return this.mediaRecorder?.state === 'recording';
    }

    public isStreamAvailable() {
        return this.currentStream != null;
    }
}

export const screenRecorder = new ScreenRecorder(); 
