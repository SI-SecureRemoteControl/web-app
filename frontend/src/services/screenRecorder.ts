class ScreenRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private currentStream: MediaStream | null = null; 

    private onRecordingStatusChange: ((status: string) => void) | null = null;

    public setOnRecordingStatusChange(callback: (status: string) => void) {
        this.onRecordingStatusChange = callback;
    }

    public setStream(stream: MediaStream | null) {
        this.currentStream = stream;
        if (this.onRecordingStatusChange && stream) {
            this.onRecordingStatusChange('Stream spreman za snimanje.');
        } else if (this.onRecordingStatusChange && !stream) {
            this.onRecordingStatusChange('Čekam stream...');
        }
    }

    public startRecording(): boolean {
        if (!this.currentStream) {
            console.error('Nije moguće započeti snimanje: MediaStream nije dostupan.');
            this.onRecordingStatusChange?.('Greška: Stream nije dostupan.');
            return false;
        }

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.warn('Snimanje je već u toku.');
            this.onRecordingStatusChange?.('Snimanje je već u toku.');
            return true;
        }

        this.recordedChunks = []; 
        this.onRecordingStatusChange?.('Snimanje u toku...');
        console.log('Pokušavam započeti snimanje...');

        try {
            const options = { mimeType: 'video/webm; codecs=vp8,opus' };
            this.mediaRecorder = new MediaRecorder(this.currentStream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('Snimanje zaustavljeno. Spremno za preuzimanje.');
                this.onRecordingStatusChange?.('Snimanje zaustavljeno. Spremno za preuzimanje.');
                this.downloadRecording();
            };

            this.mediaRecorder.onerror = (event: Event) => { 
                const error = (event as any).error;
                console.error('MediaRecorder greška:', error);
                this.onRecordingStatusChange?.(`Greška snimanja: ${error.name}`);
                alert(`Greška snimanja: ${error.name}`);
            };

            this.mediaRecorder.start(1000); 
            console.log('Snimanje započeto.');
            return true;

        } catch (e: any) {
            console.error('Nije moguće kreirati MediaRecorder:', e);
            this.onRecordingStatusChange?.(`Greška pri pokretanju snimanja: ${e.message}`);
            alert(`Greška pri pokretanju snimanja: ${e.message}`);
            return false;
        }
    }

    public stopRecording(): void {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.log('Zaustavljam snimanje...');
            this.onRecordingStatusChange?.('Zaustavljam snimanje...');
            this.mediaRecorder.stop();
        } else {
            console.warn('Snimanje nije aktivno ili MediaRecorder nije inicijalizovan.');
            this.onRecordingStatusChange?.('Snimanje nije aktivno.');
        }
    }

    private downloadRecording(): void {
        if (this.recordedChunks.length === 0) {
            console.warn('Nema podataka za snimanje.');
            this.onRecordingStatusChange?.('Nema podataka za preuzimanje.');
            return;
        }

        const superBuffer = new Blob(this.recordedChunks, { type: 'video/webm' });

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
        this.onRecordingStatusChange?.('Snimak uspešno preuzet.');
    }

    public isRecording(): boolean {
        return this.mediaRecorder?.state === 'recording';
    }

    public isStreamAvailable() {
        return this.currentStream != null;
    }
}

export const screenRecorder = new ScreenRecorder(); 