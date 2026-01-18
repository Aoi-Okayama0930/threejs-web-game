import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface GameState {
  score: number;
  health: number;
  gameOver: boolean;
  isPaused: boolean;
}

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<THREE.Mesh | null>(null);
  const bulletsRef = useRef<THREE.Mesh[]>([]);
  const enemiesRef = useRef<THREE.Mesh[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    health: 100,
    gameOver: false,
    isPaused: false,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000814);
    scene.fog = new THREE.Fog(0x000814, 100, 500);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 30;
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create player
    const playerGeometry = new THREE.ConeGeometry(1, 3, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.z = 0;
    player.castShadow = true;
    player.receiveShadow = true;
    scene.add(player);
    playerRef.current = player;

    // Stars background
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5 });
    const starsVertices = [];
    for (let i = 0; i < 1000; i++) {
      starsVertices.push(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200
      );
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starsVertices), 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Game variables
    let score = 0;
    let health = 100;
    let gameOver = false;
    let waveCount = 0;
    let enemySpawnTimer = 0;

    // Input handling
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key === ' ') {
        e.preventDefault();
        if (!gameOver && playerRef.current) {
          const bulletGeometry = new THREE.SphereGeometry(0.3, 8, 8);
          const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 });
          const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
          bullet.position.copy(playerRef.current.position);
          bullet.position.z += 2;
          bullet.castShadow = true;
          bullet.receiveShadow = true;
          scene.add(bullet);
          bulletsRef.current.push(bullet);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Spawn enemies
    const spawnEnemy = () => {
      const enemyGeometry = new THREE.OctahedronGeometry(1);
      const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0055 });
      const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
      enemy.position.x = (Math.random() - 0.5) * 40;
      enemy.position.y = (Math.random() - 0.5) * 40;
      enemy.position.z = -50;
      enemy.castShadow = true;
      enemy.receiveShadow = true;
      scene.add(enemy);
      enemiesRef.current.push(enemy);
    };

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      if (!gameOver) {
        // Player movement
        if (playerRef.current) {
          const speed = 0.5;
          if (keysRef.current['arrowup'] || keysRef.current['w']) playerRef.current.position.y += speed;
          if (keysRef.current['arrowdown'] || keysRef.current['s']) playerRef.current.position.y -= speed;
          if (keysRef.current['arrowleft'] || keysRef.current['a']) playerRef.current.position.x -= speed;
          if (keysRef.current['arrowright'] || keysRef.current['d']) playerRef.current.position.x += speed;

          // Boundary check
          playerRef.current.position.x = Math.max(-20, Math.min(20, playerRef.current.position.x));
          playerRef.current.position.y = Math.max(-20, Math.min(20, playerRef.current.position.y));
        }

        // Update bullets
        for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
          const bullet = bulletsRef.current[i];
          bullet.position.z += 1;

          // Check collision with enemies
          for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
            const enemy = enemiesRef.current[j];
            const distance = bullet.position.distanceTo(enemy.position);
            if (distance < 2) {
              scene.remove(bullet);
              scene.remove(enemy);
              bulletsRef.current.splice(i, 1);
              enemiesRef.current.splice(j, 1);
              score += 10;
              setGameState((prev) => ({ ...prev, score }));
              break;
            }
          }

          // Remove bullet if too far
          if (bullet.position.z > 100) {
            scene.remove(bullet);
            bulletsRef.current.splice(i, 1);
          }
        }

        // Update enemies
        for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
          const enemy = enemiesRef.current[i];
          enemy.position.z += 0.3;
          enemy.rotation.x += 0.02;
          enemy.rotation.y += 0.02;

          // Check collision with player
          if (playerRef.current && enemy.position.distanceTo(playerRef.current.position) < 3) {
            scene.remove(enemy);
            enemiesRef.current.splice(i, 1);
            health -= 10;
            setGameState((prev) => ({ ...prev, health }));
            if (health <= 0) {
              gameOver = true;
              setGameState((prev) => ({ ...prev, gameOver: true }));
            }
          }

          // Remove enemy if too far
          if (enemy.position.z > 50) {
            scene.remove(enemy);
            enemiesRef.current.splice(i, 1);
            health -= 5;
            setGameState((prev) => ({ ...prev, health }));
            if (health <= 0) {
              gameOver = true;
              setGameState((prev) => ({ ...prev, gameOver: true }));
            }
          }
        }

        // Spawn new enemies
        enemySpawnTimer++;
        if (enemySpawnTimer > 60 - waveCount * 5) {
          spawnEnemy();
          enemySpawnTimer = 0;
          if (score > 0 && score % 100 === 0) {
            waveCount++;
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  const handleRestart = () => {
    window.location.reload();
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <div ref={containerRef} className="w-full h-full" />

      {/* HUD */}
      <div className="absolute top-4 left-4 text-white font-mono text-lg">
        <div>Score: {gameState.score}</div>
        <div>Health: {gameState.health}%</div>
      </div>

      {/* Game Over Screen */}
      {gameState.gameOver && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-red-500 mb-4">GAME OVER</h1>
            <p className="text-2xl text-white mb-8">Final Score: {gameState.score}</p>
            <button
              onClick={handleRestart}
              className="px-8 py-3 bg-green-500 text-black font-bold rounded hover:bg-green-400 transition"
            >
              Restart Game
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-white font-mono text-sm opacity-70">
        <div>Arrow Keys / WASD - Move</div>
        <div>Space - Shoot</div>
      </div>
    </div>
  );
}
