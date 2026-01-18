import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface GameState {
  score: number;
  health: number;
  gameOver: boolean;
  level: number;
  weaponType: 'basic' | 'rapid' | 'spread';
  difficulty: 'easy' | 'normal' | 'hard';
  isPaused: boolean;
  bossActive: boolean;
  bossHealth: number;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
}

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<THREE.Mesh | null>(null);
  const bulletsRef = useRef<THREE.Mesh[]>([]);
  const enemiesRef = useRef<THREE.Mesh[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const bossRef = useRef<THREE.Mesh | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    health: 100,
    gameOver: false,
    level: 1,
    weaponType: 'basic',
    difficulty: 'normal',
    isPaused: false,
    bossActive: false,
    bossHealth: 0,
  });
  const [showDifficultySelect, setShowDifficultySelect] = useState(true);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('spaceShooterHighScore');
    return saved ? parseInt(saved) : 0;
  });

  useEffect(() => {
    if (!containerRef.current || !showDifficultySelect) return;

    if (showDifficultySelect) return;

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
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88 });
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
    let level = 1;
    let waveCount = 0;
    let enemySpawnTimer = 0;
    let weaponType: 'basic' | 'rapid' | 'spread' = 'basic';
    let difficulty: 'easy' | 'normal' | 'hard' = gameState.difficulty;
    let bossActive = false;
    let bossHealth = 0;
    let bossSpawned = false;

    // Difficulty settings
    const difficultySettings = {
      easy: { spawnRate: 100, enemySpeed: 0.2, enemyDamage: 5 },
      normal: { spawnRate: 60, enemySpeed: 0.3, enemyDamage: 10 },
      hard: { spawnRate: 40, enemySpeed: 0.4, enemyDamage: 15 },
    };

    const createParticle = (position: THREE.Vector3, color: number, velocity: THREE.Vector3) => {
      const geometry = new THREE.SphereGeometry(0.2, 4, 4);
      const material = new THREE.MeshStandardMaterial({ color, emissive: color });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      scene.add(mesh);
      particlesRef.current.push({
        mesh,
        velocity,
        lifetime: 0,
        maxLifetime: 30,
      });
    };

    // Input handling
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key === ' ') {
        e.preventDefault();
        if (!gameOver && playerRef.current) {
          if (weaponType === 'basic') {
            const bulletGeometry = new THREE.SphereGeometry(0.3, 8, 8);
            const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00 });
            const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
            bullet.position.copy(playerRef.current.position);
            bullet.position.z += 2;
            bullet.castShadow = true;
            bullet.receiveShadow = true;
            scene.add(bullet);
            bulletsRef.current.push(bullet);
          } else if (weaponType === 'rapid') {
            for (let i = 0; i < 2; i++) {
              const bulletGeometry = new THREE.SphereGeometry(0.2, 8, 8);
              const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff });
              const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
              bullet.position.copy(playerRef.current.position);
              bullet.position.x += (i - 0.5) * 1;
              bullet.position.z += 2;
              bullet.castShadow = true;
              bullet.receiveShadow = true;
              scene.add(bullet);
              bulletsRef.current.push(bullet);
            }
          } else if (weaponType === 'spread') {
            for (let i = 0; i < 3; i++) {
              const bulletGeometry = new THREE.SphereGeometry(0.25, 8, 8);
              const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff });
              const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
              bullet.position.copy(playerRef.current.position);
              bullet.position.x += (i - 1) * 1.5;
              bullet.position.z += 2;
              bullet.castShadow = true;
              bullet.receiveShadow = true;
              scene.add(bullet);
              bulletsRef.current.push(bullet);
            }
          }
        }
      }
      if (e.key === 'w' || e.key === 'W') {
        weaponType = weaponType === 'basic' ? 'rapid' : weaponType === 'rapid' ? 'spread' : 'basic';
        setGameState((prev) => ({ ...prev, weaponType }));
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
      const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0055, emissive: 0xff0055 });
      const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
      enemy.position.x = (Math.random() - 0.5) * 40;
      enemy.position.y = (Math.random() - 0.5) * 40;
      enemy.position.z = -50;
      enemy.castShadow = true;
      enemy.receiveShadow = true;
      scene.add(enemy);
      enemiesRef.current.push(enemy);
    };

    // Spawn boss
    const spawnBoss = () => {
      const bossGeometry = new THREE.IcosahedronGeometry(3, 4);
      const bossMaterial = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff6600 });
      const boss = new THREE.Mesh(bossGeometry, bossMaterial);
      boss.position.z = -80;
      boss.castShadow = true;
      boss.receiveShadow = true;
      scene.add(boss);
      bossRef.current = boss;
      bossActive = true;
      bossHealth = 100;
      setGameState((prev) => ({ ...prev, bossActive: true, bossHealth: 100 }));
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
          playerRef.current.rotation.z += 0.02;
        }

        // Update particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const particle = particlesRef.current[i];
          particle.mesh.position.add(particle.velocity);
          particle.lifetime++;
          const alpha = 1 - particle.lifetime / particle.maxLifetime;
          if (Array.isArray(particle.mesh.material)) {
            particle.mesh.material.forEach((mat: any) => (mat.opacity = alpha));
          } else {
            (particle.mesh.material as any).opacity = alpha;
          }

          if (particle.lifetime >= particle.maxLifetime) {
            scene.remove(particle.mesh);
            particlesRef.current.splice(i, 1);
          }
        }

        // Update bullets
        for (let i = bulletsRef.current.length - 1; i >= 0; i--) {
          const bullet = bulletsRef.current[i];
          bullet.position.z += 1;

          // Check collision with boss
          if (bossRef.current && bullet.position.distanceTo(bossRef.current.position) < 5) {
            createParticle(bullet.position, 0xffaa00, new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5));
            scene.remove(bullet);
            bulletsRef.current.splice(i, 1);
            bossHealth -= 5;
            if (bossHealth <= 0) {
              scene.remove(bossRef.current);
              bossRef.current = null;
              bossActive = false;
              score += 500;
              level++;
              setGameState((prev) => ({ ...prev, score, level, bossActive: false }));
            } else {
              setGameState((prev) => ({ ...prev, bossHealth }));
            }
            continue;
          }

          // Check collision with enemies
          for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
            const enemy = enemiesRef.current[j];
            const distance = bullet.position.distanceTo(enemy.position);
            if (distance < 2) {
              createParticle(bullet.position, 0xff00ff, new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5));
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

        // Update boss
        if (bossRef.current) {
          bossRef.current.position.z += 0.1;
          bossRef.current.rotation.x += 0.01;
          bossRef.current.rotation.y += 0.01;

          // Boss attacks
          if (Math.random() < 0.02) {
            for (let i = 0; i < 5; i++) {
              const angle = (i / 5) * Math.PI * 2;
              const bulletGeometry = new THREE.SphereGeometry(0.4, 8, 8);
              const bulletMaterial = new THREE.MeshStandardMaterial({ color: 0xff3333 });
              const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
              bullet.position.copy(bossRef.current.position);
              bullet.userData.isEnemyBullet = true;
              bullet.userData.velocity = new THREE.Vector3(Math.cos(angle) * 0.3, Math.sin(angle) * 0.3, 0.5);
              scene.add(bullet);
              bulletsRef.current.push(bullet);
            }
          }

          if (playerRef.current && bossRef.current.position.distanceTo(playerRef.current.position) < 5) {
            scene.remove(bossRef.current);
            bossRef.current = null;
            bossActive = false;
            health -= 20;
            setGameState((prev) => ({ ...prev, health, bossActive: false }));
            if (health <= 0) {
              gameOver = true;
              setGameState((prev) => ({ ...prev, gameOver: true }));
            }
          }
        }

        // Update enemies
        for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
          const enemy = enemiesRef.current[i];
          enemy.position.z += difficultySettings[difficulty].enemySpeed;
          enemy.rotation.x += 0.02;
          enemy.rotation.y += 0.02;

          // Check collision with player
          if (playerRef.current && enemy.position.distanceTo(playerRef.current.position) < 3) {
            scene.remove(enemy);
            enemiesRef.current.splice(i, 1);
            health -= difficultySettings[difficulty].enemyDamage;
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
        if (enemySpawnTimer > difficultySettings[difficulty].spawnRate - level * 5) {
          spawnEnemy();
          enemySpawnTimer = 0;
        }

        // Spawn boss every 500 points
        if (score > 0 && score % 500 === 0 && !bossSpawned && !bossActive) {
          spawnBoss();
          bossSpawned = true;
        }
        if (score % 500 !== 0) {
          bossSpawned = false;
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
      if (containerRef.current && renderer.domElement.parentElement === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [showDifficultySelect, gameState.difficulty]);

  const handleRestart = () => {
    if (gameState.score > highScore) {
      setHighScore(gameState.score);
      localStorage.setItem('spaceShooterHighScore', gameState.score.toString());
    }
    setShowDifficultySelect(true);
  };

  const handleStartGame = (difficulty: 'easy' | 'normal' | 'hard') => {
    setGameState({
      score: 0,
      health: 100,
      gameOver: false,
      level: 1,
      weaponType: 'basic',
      difficulty,
      isPaused: false,
      bossActive: false,
      bossHealth: 0,
    });
    setShowDifficultySelect(false);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <div ref={containerRef} className="w-full h-full" />

      {/* Difficulty Select Screen */}
      {showDifficultySelect && (
        <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-cyan-400 mb-8">SPACE SHOOTER</h1>
            <p className="text-xl text-white mb-12">難易度を選択してください</p>
            <div className="flex gap-6 justify-center">
              <button
                onClick={() => handleStartGame('easy')}
                className="px-8 py-4 bg-green-500 text-black font-bold rounded hover:bg-green-400 transition text-lg"
              >
                EASY
              </button>
              <button
                onClick={() => handleStartGame('normal')}
                className="px-8 py-4 bg-yellow-500 text-black font-bold rounded hover:bg-yellow-400 transition text-lg"
              >
                NORMAL
              </button>
              <button
                onClick={() => handleStartGame('hard')}
                className="px-8 py-4 bg-red-500 text-black font-bold rounded hover:bg-red-400 transition text-lg"
              >
                HARD
              </button>
            </div>
            <p className="text-white mt-12 text-sm">ハイスコア: {highScore}</p>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-4 left-4 text-white font-mono text-lg z-10">
        <div className="text-cyan-400">Score: {gameState.score}</div>
        <div className="text-green-400">Health: {gameState.health}%</div>
        <div className="text-yellow-400">Level: {gameState.level}</div>
        <div className="text-purple-400">Weapon: {gameState.weaponType.toUpperCase()}</div>
      </div>

      {/* Boss Health Bar */}
      {gameState.bossActive && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-64 z-10">
          <div className="text-center text-orange-400 font-bold mb-2">BOSS</div>
          <div className="w-full bg-gray-800 rounded h-6 border-2 border-orange-400">
            <div
              className="bg-orange-500 h-full rounded transition-all"
              style={{ width: `${(gameState.bossHealth / 100) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.gameOver && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-red-500 mb-4">GAME OVER</h1>
            <p className="text-2xl text-white mb-4">Final Score: {gameState.score}</p>
            <p className="text-xl text-yellow-400 mb-8">Level: {gameState.level}</p>
            {gameState.score === highScore && gameState.score > 0 && (
              <p className="text-xl text-cyan-400 mb-8">🎉 NEW HIGH SCORE! 🎉</p>
            )}
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
      <div className="absolute bottom-4 left-4 text-white font-mono text-sm opacity-70 z-10">
        <div>Arrow Keys / WASD - Move</div>
        <div>Space - Shoot</div>
        <div>W - Change Weapon</div>
      </div>
    </div>
  );
}
