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
        const videoTrack = this.currentStream?.getVideoTracks()[0];
        if (!videoTrack) {
            console.error('Nema video tracka u MediaStream-u za snimanje.');
            this.onRecordingStatusChange?.('Greška: Nema video tracka za snimanje.');
            return false;
        }

        const streamToRecord = new MediaStream([videoTrack]);
        const audioTrack = this.currentStream?.getAudioTracks()[0];
        if (audioTrack) {
            streamToRecord.addTrack(audioTrack);
        }

        if (!streamToRecord) {
            console.error('Nije moguće započeti snimanje: MediaStream nije dostupan.');
            this.onRecordingStatusChange?.('Greška: Stream nije dostupan.');
            return false;
        }

        console.log(`Stream za snimanje aktivan: ${streamToRecord.active}`);
        streamToRecord.getTracks().forEach(track => {
                console.log(`Track: Kind=<span class="math-inline">${track.kind}, ID=</span>${track.id}, Enabled=<span class="math-inline">${track.enabled}, ReadyState=</span>${track.readyState}`);
         });

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            console.warn('Snimanje je već u toku.');
            this.onRecordingStatusChange?.('Snimanje je već u toku.');
            return true;
        }

        //this.recordedChunks = []; 
        this.onRecordingStatusChange?.('Snimanje u toku...');
        console.log('Pokušavam započeti snimanje...');

        try {
            this.mediaRecorder = new MediaRecorder(streamToRecord);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log(event.data);
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
            console.log(this.recordedChunks);
            this.onRecordingStatusChange?.('Zaustavljam snimanje...');
            this.mediaRecorder.stop();
        } else {
            console.warn('Snimanje nije aktivno ili MediaRecorder nije inicijalizovan.');
            this.onRecordingStatusChange?.('Snimanje nije aktivno.');
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
