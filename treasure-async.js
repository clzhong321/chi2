// ============================================================
// 实验二：JavaScript 异步之寻宝  —— async/await 重写版
// 在原 treasure.js 的基础上：
//   1) 新增了「迷雾森林 / 湍急河流 / 神秘石门 / 最终宝藏揭晓」等情节
//   2) 全部改为 async / await 写法
//   3) 「解码古老文字」「神秘石门」等解密情节会随机失败，
//      借助 withRetry 反复尝试、逐步逼近成功，体现异步流程的容错与重试；
//      即使连续多次失败也有兜底方案，寻宝最终一定能成功，不会整局失败
//   4) 通过 onEvent 回调把每一步的进展暴露给页面，便于驱动动画
// 说明：本文件不改动原 treasure.js，为独立文件。
// 可在 Node 环境直接运行，也可被浏览器页面 index.html 引用。
// ============================================================

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TreasureHunt = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  // ---------- 工具：延时函数 ----------
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------- 工具：带重试的异步步骤 ----------
  // fn: 返回 Promise 的无参函数；maxRetries: 最多重试次数
  // fallback: 重试次数用尽时的兜底结果（字符串或函数），
  //           传入后即使多次失败也只会"换个思路成功"，不会让整个流程失败
  async function withRetry(id, fn, maxRetries, onEvent, fallback) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) {
          // 重试次数用尽：不再抛出终止，而是兜底成功，保证寻宝不会卡死
          if (fallback) {
            onEvent &&
              onEvent({
                type: "step-retry",
                id,
                attempt: maxRetries,
                max: maxRetries,
                message: `${err}（已尝试 ${maxRetries} 次仍未成功，换个思路再试一次…）`,
              });
            await sleep(600);
            return typeof fallback === "function" ? fallback(err) : fallback;
          }
          throw err; // 未提供兜底时才向上抛出
        }
        onEvent &&
          onEvent({
            type: "step-retry",
            id,
            attempt,
            max: maxRetries,
            message: `${err}（第 ${attempt}/${maxRetries} 次重试…）`,
          });
        await sleep(600); // 失败后稍作停顿再重试
      }
    }
  }

  // ============================================================
  // 宝藏地图 API（全部用 Promise 封装，配合 async/await 使用）
  // ============================================================
  class TreasureMap {
    // 1. 在图书馆找到第一个线索
    static async getInitialClue() {
      await sleep(1000);
      return "在古老的图书馆里找到了第一个线索…";
    }

    // 2. 解码古老文字（可能破译失败，需要反复尝试）
    static async decodeAncientScript(clue) {
      await sleep(1500);
      if (!clue) {
        throw "没有线索可以解码!";
      }
      // 50% 概率破译失败，体现"解密不是一次就能成功"
      if (Math.random() < 0.5) {
        const reasons = [
          "咒文读错了一个音节，羊皮卷上的文字毫无反应…",
          "把古老的象形符号认错了，解码失败…",
          "念诵顺序颠倒了，符文闪了一下又熄灭…",
          "光线太暗，看漏了一行注解，解码失败…",
          "墨迹被岁月侵蚀，好像理解错了这句话的意思…",
        ];
        throw reasons[Math.floor(Math.random() * reasons.length)];
      }
      return "解码成功!宝藏在一座古老的神庙中…";
    }

    // 3. 【新增情节】穿越迷雾森林
    static async crossMistyForest(location) {
      await sleep(1200);
      const random = Math.random();
      if (random < 0.3) {
        throw "在森林里迷失了方向!";
      }
      return "穿过了迷雾森林，前方出现一条湍急的河流…";
    }

    // 4. 【新增情节】渡过湍急河流
    static async crossRiver() {
      await sleep(1300);
      const random = Math.random();
      if (random < 0.4) {
        throw "小船被急流掀翻了!";
      }
      return "成功渡过河流，抵达神庙入口!";
    }

    // 5. 【新增情节】破解神秘石门（机关谜题，可能多次失败）
    static async solveStoneDoor() {
      await sleep(1500);
      const random = Math.random();
      if (random < 0.4) {
        const reasons = [
          "石门的机关谜题解错了，齿轮又转回了原位…",
          "触碰了错误的机关，石门纹丝不动…",
          "符文顺序排反了，门上的光纹熄灭…",
          "破解到一半，机关突然重置了…",
        ];
        throw reasons[Math.floor(Math.random() * reasons.length)];
      }
      return "轰隆一声，石门缓缓打开…";
    }

    // 6. 在神庙中搜寻（有守卫风险）
    static async searchTemple(location) {
      await sleep(2000);
      const random = Math.random();
      if (random < 0.4) {
        throw "糟糕!遇到了神庙守卫!";
      }
      return "找到了一个神秘的箱子…";
    }

    // 7. 打开宝箱
    static async openTreasureBox() {
      await sleep(1000);
      return "恭喜!你找到了传说中的宝藏!";
    }
  }

  // ============================================================
  // 寻宝主流程：使用 async/await 顺序驱动每一步
  // onEvent 用于向页面/控制台广播进展
  // ============================================================
  async function runTreasureHunt(onEvent) {
    const emit = (e) => {
      if (onEvent) onEvent(e);
      // 控制台同步输出，方便 Node 直接运行查看
      if (typeof console !== "undefined") {
        if (e.type === "step-success" || e.type === "complete") {
          console.log(e.message);
        } else if (e.type === "step-retry") {
          console.warn(e.message);
        } else if (e.type === "step-start") {
          console.log(`【${e.name}】${e.desc}`);
        } else if (e.type === "abort") {
          console.error(e.message);
        }
      }
    };

    // 每一步的元数据，供动画页面渲染
    const steps = [
      { id: "library", name: "古老的图书馆", desc: "寻找第一个线索", maxRetries: 0 },
      { id: "decode", name: "解码古老文字", desc: "破译羊皮卷上的密文（可能多次失败）", maxRetries: 5 },
      { id: "forest", name: "迷雾森林", desc: "穿越幽暗的迷雾森林", maxRetries: 3 },
      { id: "river", name: "湍急河流", desc: "渡过湍急的河流", maxRetries: 3 },
      { id: "door", name: "神秘石门", desc: "破解石门上的机关谜题（可能多次失败）", maxRetries: 5 },
      { id: "temple", name: "古老神庙", desc: "在神庙中搜寻宝箱", maxRetries: 3 },
      { id: "chest", name: "神秘宝箱", desc: "打开尘封的宝箱", maxRetries: 0 },
    ];
    const meta = Object.fromEntries(steps.map((s) => [s.id, s]));

    const start = (id) => emit({ type: "step-start", ...meta[id] });
    const ok = (id, message) => emit({ type: "step-success", id, message });

    try {
      // 1. 图书馆
      start("library");
      const clue = await TreasureMap.getInitialClue();
      ok("library", clue);

      // 2. 解码（解密可能失败，最多反复尝试 5 次）
      start("decode");
      const location = await withRetry(
        "decode",
        () => TreasureMap.decodeAncientScript(clue),
        5,
        emit,
        "翻遍典籍、请教了老学者，总算把羊皮卷上的古老文字解读出来了，解码成功!宝藏在一座古老的神庙中…"
      );
      ok("decode", location);

      // 3. 迷雾森林（可重试）
      start("forest");
      const forestMsg = await withRetry(
        "forest",
        () => TreasureMap.crossMistyForest(location),
        3,
        emit,
        "靠着罗盘重新辨明方向，绕了几圈后终于走出了迷雾森林，前方出现一条湍急的河流…"
      );
      ok("forest", forestMsg);

      // 4. 湍急河流（可重试）
      start("river");
      const riverMsg = await withRetry(
        "river",
        () => TreasureMap.crossRiver(),
        3,
        emit,
        "换了个水流稍缓的渡口，终于成功渡过河流，抵达神庙入口!"
      );
      ok("river", riverMsg);

      // 5. 神秘石门（可重试）
      start("door");
      const doorMsg = await withRetry(
        "door",
        () => TreasureMap.solveStoneDoor(),
        5,
        emit,
        "反复推敲机关的组合，石门终于轰隆一声缓缓打开…"
      );
      ok("door", doorMsg);

      // 6. 神庙搜索（可重试）
      start("temple");
      const box = await withRetry(
        "temple",
        () => TreasureMap.searchTemple(location),
        3,
        emit,
        "避开守卫的巡逻路线，终于找到了一个神秘的箱子…"
      );
      ok("temple", box);

      // 7. 打开宝箱
      start("chest");
      const treasure = await TreasureMap.openTreasureBox();
      ok("chest", treasure);

      // 完成
      emit({
        type: "complete",
        message: "🎉 寻宝成功!传说中的宝藏已经到手!",
      });
      return treasure;
    } catch (error) {
      emit({ type: "abort", message: `任务失败: ${error}` });
      throw error;
    }
  }

  return { TreasureMap, runTreasureHunt, sleep, withRetry };
});

// ---------- Node 环境下的自动运行入口 ----------
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  const { runTreasureHunt } = module.exports;
  console.log("===== 寻宝开始（async/await 版）=====\n");
  runTreasureHunt()
    .then(() => console.log("\n===== 寻宝结束 ====="))
    .catch((e) => console.error("\n===== 寻宝失败 =====", e));
}
