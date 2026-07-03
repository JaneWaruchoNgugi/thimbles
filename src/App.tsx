import { useEffect, useRef, useState } from 'react';
import './App.css';
import { LiveGame } from './shellrush/LiveGame';
import { ShellRush } from './shellrush/ShellRush';
import { music, resumeAudio } from './shellrush/sound';

function App() {
    // shared wallet + settings for both the live landing page and the solo mini game
    const [balance, setBalance] = useState(4976);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [soloOpen, setSoloOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleSound = () => setSoundEnabled((s) => !s);

    // native (F11-style) fullscreen on the whole app
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
        else document.exitFullscreen?.();
    };
    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    // Background music — browsers block audio until a gesture, so start it on the
    // first interaction, then follow the sound toggle. Stops on unmount.
    const soundRef = useRef(soundEnabled);
    soundRef.current = soundEnabled;
    useEffect(() => {
        const kick = () => { resumeAudio(); if (soundRef.current) music.start(); };
        window.addEventListener('pointerdown', kick, { once: true });
        return () => window.removeEventListener('pointerdown', kick);
    }, []);
    useEffect(() => { music.setEnabled(soundEnabled); }, [soundEnabled]);
    useEffect(() => () => music.stop(), []);

    return (
        <>
            {/* LIVE is the landing page */}
            <LiveGame
                balance={balance}
                setBalance={setBalance}
                soundEnabled={soundEnabled}
                onToggleSound={toggleSound}
                isFullscreen={isFullscreen}
                toggleFullscreen={toggleFullscreen}
                onOpenSolo={() => setSoloOpen(true)}
                soloOpen={soloOpen}
            />

            {/* Solo "mini game" opens as a full overlay on top of LIVE */}
            {soloOpen && (
                <ShellRush
                    balance={balance}
                    setBalance={setBalance}
                    soundEnabled={soundEnabled}
                    onToggleSound={toggleSound}
                    isFullscreen={isFullscreen}
                    toggleFullscreen={toggleFullscreen}
                    onClose={() => setSoloOpen(false)}
                />
            )}
        </>
    );
}

export default App;
