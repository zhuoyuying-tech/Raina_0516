/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Trophy, User } from 'lucide-react';

// 游戏常量配置
const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

export default function App() {
  // 棋盘状态：二维数组，0为无子，1为黑子，2为白子
  const [board, setBoard] = useState<number[][]>(
    Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY))
  );
  // 当前落子方：1为黑，2为白
  const [currentPlayer, setCurrentPlayer] = useState<number>(BLACK);
  // 胜负状态：null为进行中，1或2为对应获胜方
  const [winner, setWinner] = useState<number | null>(null);
  // 获胜的五枚棋子坐标，用于高亮
  const [winningLine, setWinningLine] = useState<{ r: number; c: number }[]>([]);
  // 游戏模式：PVP (玩家对战), PVE (人机对战)
  const [mode, setMode] = useState<'PVP' | 'PVE'>('PVE');
  // AI 是否正在思考状态
  const [isAiThinking, setIsAiThinking] = useState(false);

  /**
   * AI 评估函数：为落子点打分
   * 采用启发式评分：攻击（自己连线）+ 防守（阻止对方连线）
   */
  const evaluateMove = useCallback((board: number[][], r: number, c: number, player: number) => {
    const opponent = player === BLACK ? WHITE : BLACK;
    let score = 0;

    const directions = [
      { dr: 0, dc: 1 },  // 水平
      { dr: 1, dc: 0 },  // 垂直
      { dr: 1, dc: 1 },  // 主对角线
      { dr: 1, dc: -1 }, // 副对角线
    ];

    const getScoreForPattern = (count: number, openEnds: number, isSelf: boolean) => {
      if (count >= 5) return 1000000;
      if (isSelf) {
        if (count === 4) return openEnds >= 1 ? 100000 : 10000;
        if (count === 3) return openEnds >= 2 ? 10000 : 1000;
        if (count === 2) return openEnds >= 2 ? 1000 : 100;
      } else {
        // 防守分数略高，优先堵截
        if (count === 4) return openEnds >= 1 ? 50000 : 5000;
        if (count === 3) return openEnds >= 2 ? 5000 : 500;
        if (count === 2) return openEnds >= 2 ? 500 : 50;
      }
      return 0;
    };

    for (const { dr, dc } of directions) {
      // 评估攻击
      const selfResult = checkPattern(board, r, c, dr, dc, player);
      score += getScoreForPattern(selfResult.count, selfResult.openEnds, true);

      // 评估防守
      const oppResult = checkPattern(board, r, c, dr, dc, opponent);
      score += getScoreForPattern(oppResult.count, oppResult.openEnds, false);
    }

    return score;
  }, []);

  const checkPattern = (board: number[][], r: number, c: number, dr: number, dc: number, player: number) => {
    let count = 1;
    let openEnds = 0;

    // 正向
    for (let i = 1; i < 5; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (board[nr][nc] === player) count++;
      else {
        if (board[nr][nc] === EMPTY) openEnds++;
        break;
      }
    }
    // 反向
    for (let i = 1; i < 5; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
      if (board[nr][nc] === player) count++;
      else {
        if (board[nr][nc] === EMPTY) openEnds++;
        break;
      }
    }
    return { count, openEnds };
  };

  /**
   * AI 落子逻辑
   */
  const makeAiMove = useCallback(() => {
    let bestScore = -1;
    let candidates: { r: number, c: number }[] = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === EMPTY) {
          const score = evaluateMove(board, r, c, WHITE);
          if (score > bestScore) {
            bestScore = score;
            candidates = [{ r, c }];
          } else if (score === bestScore) {
            candidates.push({ r, c });
          }
        }
      }
    }

    if (candidates.length > 0) {
      // 随机选择同分点，增加随机性
      const move = candidates[Math.floor(Math.random() * candidates.length)];
      handleMove(move.r, move.c);
    }
    setIsAiThinking(false);
  }, [board, evaluateMove]);

  // AI 回合监听
  useEffect(() => {
    if (mode === 'PVE' && currentPlayer === WHITE && !winner && !isAiThinking) {
      setIsAiThinking(true);
      const timer = setTimeout(makeAiMove, 600); // 延迟模拟思考
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, mode, winner, isAiThinking, makeAiMove]);

  /**
   * 判断当前落子是否导致胜利
   * @param r 行索引
   * @param c 列索引
   * @param player 玩家
   */
  const checkWin = (board: number[][], r: number, c: number, player: number) => {
    const directions = [
      { dr: 0, dc: 1 },  // 水平
      { dr: 1, dc: 0 },  // 垂直
      { dr: 1, dc: 1 },  // 主对角线
      { dr: 1, dc: -1 }, // 副对角线
    ];

    for (const { dr, dc } of directions) {
      let count = 1;
      let line = [{ r, c }];

      // 正向搜索
      for (let i = 1; i < 5; i++) {
        const nr = r + dr * i;
        const nc = c + dc * i;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
          count++;
          line.push({ r: nr, c: nc });
        } else break;
      }
      // 反向搜索
      for (let i = 1; i < 5; i++) {
        const nr = r - dr * i;
        const nc = c - dc * i;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && board[nr][nc] === player) {
          count++;
          line.push({ r: nr, c: nc });
        } else break;
      }

      if (count >= 5) {
        return line;
      }
    }
    return null;
  };

  /**
   * 处理落子逻辑
   */
  const handleMove = (r: number, c: number) => {
    if (board[r][c] !== EMPTY || winner) return;

    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = currentPlayer;
    setBoard(newBoard);

    const winLine = checkWin(newBoard, r, c, currentPlayer);
    if (winLine) {
      setWinner(currentPlayer);
      setWinningLine(winLine);
    } else {
      setCurrentPlayer(currentPlayer === BLACK ? WHITE : BLACK);
    }
  };

  /**
   * 重置游戏
   */
  const resetGame = () => {
    setBoard(Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY)));
    setCurrentPlayer(BLACK);
    setWinner(null);
    setWinningLine([]);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4 font-sans text-[#1A1A1A]">
      {/* 头部标题 */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <h1 className="text-5xl font-display mb-2">禅意五子棋</h1>
        <p className="text-sm font-sans text-gray-400 uppercase tracking-widest">Zen Gomoku Experience</p>
      </motion.div>

      {/* 模式选择 */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
        <button 
          onClick={() => { setMode('PVE'); resetGame(); }}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'PVE' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
        >
          人机对战
        </button>
        <button 
          onClick={() => { setMode('PVP'); resetGame(); }}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'PVP' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
        >
          双人对战
        </button>
      </div>

      {/* 游戏状态栏 */}
      <div className="w-full max-w-[500px] flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${currentPlayer === BLACK && !winner ? 'bg-black text-white shadow-lg' : 'bg-transparent text-black opacity-50'}`}>
            <div className={`w-3 h-3 rounded-full bg-black border border-gray-600`} />
            <span className="text-xs font-medium uppercase tracking-tighter">黑棋先手</span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${currentPlayer === WHITE && !winner ? 'bg-white text-black shadow-lg' : 'bg-transparent text-black opacity-50'}`}>
            <div className={`w-3 h-3 rounded-full bg-white border border-gray-300`} />
            <span className="text-xs font-medium uppercase tracking-tighter">
              {mode === 'PVE' ? (isAiThinking ? 'AI 思考中...' : '白棋(AI)待落') : '白棋待落'}
            </span>
          </div>
        </div>

        <button 
          onClick={resetGame}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95 group"
          title="重置游戏"
        >
          <RotateCcw className="w-5 h-5 text-gray-500 group-hover:rotate-[-45deg] transition-transform" />
        </button>
      </div>

      {/* 棋盘容器 */}
      <div className="relative p-6 bg-[#E8D9C5] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-4 border-[#C8B8A5]">
        <div 
          className="grid gap-0" 
          style={{ 
            gridTemplateColumns: `repeat(${BOARD_SIZE - 1}, 2.5rem)`,
            gridTemplateRows: `repeat(${BOARD_SIZE - 1}, 2.5rem)`
          }}
        >
          {/* 这里其实是在格子的交点落子，所以我们要渲染的是棋盘线，然后在交点覆盖按钮 */}
          {Array(BOARD_SIZE - 1).fill(null).map((_, r) => (
            Array(BOARD_SIZE - 1).fill(null).map((_, c) => (
              <div 
                key={`${r}-${c}`} 
                className="w-10 h-10 border-t border-l border-[#8D7B68] relative"
                style={{
                  // 补全最后一列和最后一行的边框
                  borderRight: c === BOARD_SIZE - 2 ? '1px solid #8D7B68' : 'none',
                  borderBottom: r === BOARD_SIZE - 2 ? '1px solid #8D7B68' : 'none',
                }}
              >
                {/* 星位点 - 典型五子棋位置 */}
                {((r+1 === 3 || r+1 === 7 || r+1 === 11) && (c+1 === 3 || c+1 === 7 || c+1 === 11)) && (
                   <div className="absolute -top-[3px] -left-[3px] w-[6px] h-[6px] bg-[#8D7B68] rounded-full z-0" />
                )}
                {/* 最后一个星位特殊处理底部 */}
                {r === BOARD_SIZE - 2 && c === 3 && ( <div className="absolute bottom-[-3px] left-[-3px] w-[6px] h-[6px] bg-[#8D7B68] rounded-full z-0" />)}
              </div>
            ))
          ))}

          {/* 交互落子层：覆盖在棋盘线交点上的透明区域 */}
          <div className="absolute inset-0 flex flex-wrap" style={{ padding: '0.75rem' }}>
             {/* 实际交点比方框多1个 */}
             <div 
              className="grid" 
              style={{ 
                gridTemplateColumns: `repeat(${BOARD_SIZE}, 2.5rem)`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, 2.5rem)`,
                padding: '0' 
              }}
             >
                {board.map((row, r) => (
                  row.map((cell, c) => (
                    <button
                      key={`hit-${r}-${c}`}
                      onClick={() => handleMove(r, c)}
                      disabled={cell !== EMPTY || !!winner || (mode === 'PVE' && currentPlayer === WHITE)}
                      className="w-10 h-10 relative flex items-center justify-center cursor-pointer group focus:outline-none"
                    >
                      {/* 落子预览提示 */}
                      {cell === EMPTY && !winner && (
                        <div className={`w-3 h-3 rounded-full opacity-0 group-hover:opacity-20 transition-opacity ${currentPlayer === BLACK ? 'bg-black' : 'bg-white'}`} />
                      )}
                      
                      {/* 实际落下的棋子 */}
                      <AnimatePresence>
                        {cell !== EMPTY && (
                          <motion.div
                            initial={{ y: -20, opacity: 0, scale: 0.5 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{ 
                              type: "spring", 
                              stiffness: 400, 
                              damping: 20 
                            }}
                            className={`w-8 h-8 rounded-full shadow-[2px_4px_8px_rgba(0,0,0,0.3)] z-10 flex items-center justify-center ${
                              cell === BLACK ? 'bg-[#1A1A1A]' : 'bg-[#F9F9F9]'
                            }`}
                          >
                            {/* 棋子光泽效果 */}
                            <div className={`w-full h-full rounded-full ${cell === BLACK ? 'bg-gradient-to-br from-gray-600 to-transparent opacity-30 shadow-inner' : 'bg-gradient-to-br from-white to-gray-200 opacity-60 shadow-inner'}`} />
                            
                            {/* 获胜高亮效果 */}
                            {winningLine.some(p => p.r === r && p.c === c) && (
                              <motion.div 
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="absolute w-2 h-2 rounded-full bg-red-400 blur-[2px]" 
                              />
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  ))
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* 胜利弹窗 */}
      <AnimatePresence>
        {winner && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-4"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center border-t-4 border-[#C8B8A5]">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full mb-4">
                <Trophy className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {winner === BLACK ? '黑棋' : '白棋'} 荣耀获胜！
              </h2>
              <p className="text-gray-500 mb-8">
                妙手连珠，棋局已定。愿禅意与你同在。
              </p>
              <button 
                onClick={resetGame}
                className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-colors shadow-lg active:scale-95"
              >
                再开一局
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-12 text-gray-400 text-xs tracking-widest uppercase">
        Simple · Elegant · Strategic
      </footer>
    </div>
  );
}
