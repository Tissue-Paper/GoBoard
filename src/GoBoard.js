// phina.js をグローバル領域に展開
phina.globalize();

const SPACE = 0;  // 石がない
const BLACK = 1;  // 黒石
const WHITE = 2;  // 白石
const OUT   = 3;  // 碁盤の外側

const ASSETS = {
  image: {
    "wood": "../assets/image/wood.png",
  },
  sound: {
    "stone1"     : "../assets/sound/stone1.mp3",
    "stone2"     : "../assets/sound/stone2.mp3",
    "capture1"   : "../assets/sound/capture1-1.mp3",
    "capture2"   : "../assets/sound/capture1-2.mp3",
    "capture3"   : "../assets/sound/capture3-1.mp3",
    "captureMany": "../assets/sound/capture9-1.mp3",
  },
};

//---------//
// 碁盤クラス //
//---------//
class Board {
  constructor(query) {
    this.W = 19;                                     // 碁盤の横サイズ（線の数）
    this.H = 19;                                     // 碁盤の縦サイズ（線の数）
    this.turn = BLACK;                               // 現在の手番
    this.dir4 = [-(this.W + 2), 1, this.W + 2, -1];  // 上右下左への移動量
    this.query = query;                              // 指定のCanvasセレクタ
    this.padding = [5, 5, 5, 5];                     // 上右下左の余白
  }

  // 碁盤のサイズを設定するメソッド
  setSize(W, H) {
    H = H || W;
    // １～２５までの整数以外が渡されていたらセットしない
    if (typeof W !== "number" || typeof H !== "number" ||
        W % 1 || H % 1 || W < 1 || H < 1 || 25 < W || 25 < H) {
      console.error("Argument is out of range.");
    } else {
      this.W = W;
      this.H = H;
      this.dir4 = [-(this.W + 2), 1, this.W + 2, -1];
    }
    return this;
  }

  // 盤面の初期化
  dataInit() {
    this.board = [];
    this.captured = {black: 0, white: 0};
    this.ko = [0];
    this.moveNum = 0;

    // 番兵付きの１次元配列で表現する
    for (let Y = 0; Y < this.H + 2; Y++) {
    for (let X = 0; X < this.W + 2; X++) {
      if (X === 0 || Y === 0 || X === this.W + 1 || Y === this.H + 1) {
        this.board.push(OUT);
      } else {
        this.board.push(SPACE);
      }
    }
    }
    return this;
  }

  // ゲームを開始するメソッド
  start() {
    const verticalPadding = (this.padding[0] + this.padding[2]);
    const horizontalPadding = (this.padding[1] + this.padding[3]);
    const maxBoardWidth = window.innerWidth - horizontalPadding;
    const maxBoardHeight = window.innerHeight - verticalPadding;
    const stoneSize1 = Math.floor(maxBoardWidth / this.W);
    const stoneSize2 = Math.floor(maxBoardHeight / this.H);
    const self = this;

    this.stoneSize = Math.min(stoneSize1, stoneSize2);         // 碁石のサイズ
    this.width = this.stoneSize * this.W + horizontalPadding;  // 画面横サイズ
    this.height = this.stoneSize * this.H + verticalPadding;   // 画面縦サイズ
    this.dataInit();

    phina.main(function() {
      const app = GameApp({
        startLabel: 'main',
        query: self.query,
        width: self.width,
        height: self.height,
        assets: ASSETS,
        board: self,
      });
      self.app = app;

      var locked = true;
      var f = function(e){
        if(locked){
          var s = phina.asset.Sound();
          s.loadFromBuffer();
          s.play();
          s.volume=0;
          s.stop();
          locked=false;
          app.domElement.removeEventListener('touchend',f);
        }
      };
      app.domElement.addEventListener('touchend',f);
      app.run();
    });
    return this;
  }

  // 手番を入れ替えるメソッド
  pass() {
    this.moveNum++;                           // 手数を加算
    this.turn = (BLACK + WHITE) - this.turn;  // 手番を入れ替える
    if (!phina.isMobile()) {
      this.app.currentScene.stones.translucentStone.setFrameIndex(this.turn);
    }
    return this;
  }

  // 着手するメソッド
  move(X, Y) {
    const Z = (this.W + 2) * Y + X,
          stones = this.app.currentScene.stones,
          stone = stones.sprites[Z],
          turn = this.turn,
          moveFlag = this._move(X, Y);

    stones.playSound(moveFlag);
    if (moveFlag >= 0) {
      stones.removeStones(this.capturedPlace);
      stone.tweener.clear().call(function(){
        stone.setFrameIndex(turn);
        stone.alpha = 1;
      });
    }
    return moveFlag;
  }

  _move(X, Y) {
    const index = (this.W + 2) * Y + X,
          enemy = (BLACK + WHITE) - this.turn;

    if (this.board[index] !== SPACE)     return -1;  // 既に石があったら打てない
    if (index === this.ko[this.moveNum]) return -2;  // コウの取り返しはできない

    this.board[index] = this.turn;  // 仮の着手
    this.capturedNum = 0;           // 取れた石の数の初期化
    this.capturedPlace = [];        // 取れた石の座標配列の初期化

    // 上下左右を調べる
    for (let i = 0; i < 4; i++) {
      const nextIndex = index + this.dir4[i];
      // もしそこが相手の石なら
      if (this.board[nextIndex] === enemy) {
        // ダメの数を数えて、もし０なら
        if (this.countSpace(nextIndex) === 0) {
          for (let index of this.stonePlace) {
            this.board[index] = SPACE;  // 相手の石を取り除く
          }
          this.capturedNum += this.stonePlace.length; // 取れた石の数を積算
          this.capturedPlace.push(this.stonePlace);   // 取れた石の座標を記録
        }
      }
    }

    // 自分の石のダメの数を数えて、もし０なら石を戻して着手を中止する
    if (this.countSpace(index) === 0) {
      this.board[index] = SPACE;
      return -3;
    }

    // もし取った石の数＝自分の石のダメの数＝自分の石の数＝１なら
    if (this.capturedNum === 1 && this.spacePlace.length === 1 && this.stonePlace.length === 1) {
      this.ko.push(this.capturedPlace[0][0]);  // コウなので座標を記録し、次の着手で打てなくする
    } else {
      this.ko.push(0);  // 1つでも違う場合はコウではないので、適当な値を入れて次の着手での制限を無くす
    }
    if (this.turn === BLACK)      this.captured.white += this.capturedNum;
    else if (this.turn === WHITE) this.captured.black += this.capturedNum;
    this.pass();              // 手番を入れ替える
    return this.capturedNum;  // 取った石数を返す
  }

  // 石のダメの数を数えるメソッド
  countSpace(index) {
    this.checked = [];              // 調査済みフラグ配列の初期化
    this.stonePlace = [];           // 石の座標配列の初期化
    this.spacePlace = [];           // ダメの座標配列の初期化
    this._countSpace(index);        // 石とダメの座標を記録する
    return this.spacePlace.length;  // ダメの数を返す
  }

  _countSpace(index) {
    this.stonePlace.push(index);  // 石の座標を追加
    this.checked[index] = true;   // ここを調査済みとする

    // 上下左右を調べる
    for (let i = 0; i < 4; i++) {
      const nextIndex = index + this.dir4[i];

      // 隣の座標が調査済みならcontinue
      if (this.checked[nextIndex]) continue;

      // もし隣の座標がダメだったら座標を記録
      if (this.board[nextIndex] === SPACE) {
        this.spacePlace.push(nextIndex);
        this.checked[nextIndex] = true;
      // もし隣の座標が同じ色の石だったら再帰呼び出し
      } else if (this.board[nextIndex] === this.board[index]) {
        this._countSpace(nextIndex);
      }
    }
  }
}

//--------------------//
// MainScene クラスを定義 //
//--------------------//
phina.define('MainScene', {
  superClass: 'DisplayScene',
  init: function(prop) {
    this.superInit({
      width: prop.width,
      height: prop.height,
      backgroundColor: "rgb(254, 217, 129)"
    });
    const board = prop.board;

    Sprite("wood").setOrigin(0, 0).setSize(this.width, this.height).addChildTo(this);
    this.lines = Lines(board).setPosition(board.padding[3], board.padding[0]).addChildTo(this);
    this.stones = Stones(board).setPosition(board.padding[3], board.padding[0]).addChildTo(this);
  },
});

//------------------//
// 座標線を描画するクラス //
//------------------//
phina.define("LaserBeam", {
  superClass: "Shape",
  init: function(board) {
    this.superInit({
      width: board.width * 2,
      height: board.height * 2,
      stroke: "rgb(56, 124, 199)",
    });
    this.board = board;
    this.clipX = -3;
    this.clipY = -3;
    this.renderWidth = board.stoneSize * (board.W - 1) + 6;
    this.renderHeight = board.stoneSize * (board.H - 1) + 6;
  },

  moveTo(X, Y) {
    const stoneSize = this.board.stoneSize,
          x = stoneSize * (X - 0.5),
          y = stoneSize * (Y - 0.5);
    this.clipX = -(stoneSize * (X - 1) + 3);
    this.clipY = -(stoneSize * (Y - 1) + 3);
    this.setPosition(x, y);
  },

  clip: function(canvas) {
    canvas.beginPath();
    canvas.rect(this.clipX, this.clipY, this.renderWidth, this.renderHeight);
  },

  render: function(canvas) {
    canvas.lineWidth = 5;
    canvas.strokeStyle = this.stroke;
    canvas.drawLine(0, this.board.height, this.width, this.board.height);
    canvas.drawLine(this.board.width, 0, this.board.width, this.height);
    canvas.lineWidth = 2;
    canvas.strokeStyle = "white";
    canvas.drawLine(0, this.board.height, this.width, this.board.height);
    canvas.drawLine(this.board.width, 0, this.board.width, this.height);
  }
});

//--------------------//
// 碁盤の線を描画するクラス //
//-------------------//
phina.define("LineShape", {
  superClass: "Shape",
  init: function(board) {
    this.superInit({
      width: board.stoneSize * 4,
      height: board.stoneSize * 3,
    });
    this.render(this.canvas, board);
  },

  render: function(canvas, board) {
    const HALF = board.stoneSize / 2;
    let starSize = board.stoneSize * 0.07;  // 星の半径
    starSize = Math.max(starSize, 2.0);     // 最低でも2.0
    starSize = Math.min(starSize, 3.0);     // 最大でも3.0

    for (let X = 0; X < 4; X++) {
      canvas.drawLine(HALF + board.stoneSize * X, HALF, HALF + board.stoneSize * X, HALF * 5);
    }
    for (let Y = 0; Y < 3; Y++) {
      canvas.drawLine(HALF, HALF + board.stoneSize * Y, HALF * 7, HALF + board.stoneSize * Y);
    }
    canvas.fillCircle(HALF * 5, HALF * 3, starSize);
  },
});

//-----------------//
// 碁石を描画するクラス //
//----------------//
phina.define("StoneShape", {
  superClass: "Shape",
  init: function(board) {
    this.superInit({
      width: board.stoneSize * 3,
      height: board.stoneSize,
    });
    this.render(this.canvas, board);
  },

  render: function(canvas, board) {
    const STONE_SIZE = board.stoneSize,
          HALF = STONE_SIZE / 2,
          QUARTER = STONE_SIZE / 4;

    let blackGradient = Canvas.createRadialGradient(QUARTER, QUARTER, 0, QUARTER, QUARTER, STONE_SIZE / 2.5),
        whiteGradient = Canvas.createRadialGradient(HALF, HALF, HALF - 3, HALF, HALF, HALF),
        num = 90, add = -8, num2 = 255, add2 = -5;

    // 黒石の描画
    for (let i = 0; i < 10; i++) {
      const num = 90 - (8 * i),
            rgb = `rgb(${num}, ${num}, ${num})`;
      blackGradient.addColorStop(i / 10, rgb);
    }
    canvas.translate(STONE_SIZE, 0);
    canvas.fillStyle = blackGradient;
    canvas.fillCircle(HALF, HALF, HALF - 0.2);

    // 白石の描画
    for(let i = 0; i < 10; i++) {
      const num = 255 - (5 * i);
            rgb = `rgb(${num}, ${num}, ${num})`;
      whiteGradient.addColorStop(i / 10, rgb);
    }
    canvas.translate(STONE_SIZE, 0);
    canvas.fillStyle = "gray";
    canvas.fillCircle(HALF, HALF, HALF);
    canvas.fillStyle = whiteGradient;
    canvas.fillCircle(HALF, HALF, HALF - 0.8);
  },
});

//----------------//
// 碁盤の線のグループ //
//---------------//
phina.define("Lines", {
  superClass: "DisplayElement",
  init: function(board) {
    this.superInit({
      width: board.width - board.padding[1] - board.padding[3],
      height: board.height - board.padding[0] - board.padding[2],
    });
    this.board = board;
    const lines = this;
    const lineShape = LineShape(board);

    for (let Y = 1; Y <= board.H; Y++) {
      for (let X = 1; X <= board.W; X++) {
        const x = board.stoneSize * (X - 0.5),
              y = board.stoneSize * (Y - 0.5),
              i = this.lineIndex(X, Y);

        const line = Sprite(lineShape.canvas, board.stoneSize, board.stoneSize)
                    .setPosition(x, y).setFrameIndex(i).addChildTo(this);

        // 座標線の追尾設定
        if (phina.isMobile()) {
          line.setInteractive(true).addEventListener("pointover", function(){
            lines.laserBeam.moveTo(X, Y);
          });
        }
      }
    }

    // デバイスがモバイルの場合
    if (phina.isMobile()) {
      this.laserBeam = LaserBeam(board).setPosition(-100, -100).addChildTo(this);

      // カーソルが碁盤の線から出たら座標線を見えない位置に移動する
      this.setOrigin(0, 0).setInteractive(true)
          .addEventListener("pointout", function(){
            this.laserBeam.setPosition(-100, -100);
          });
    }
  },

  lineIndex: function(X, Y) {
    const maxX = this.board.W,
          maxY = this.board.H;
    if (X === 1 && Y === 1)            return 0;
    else if (X === maxX && Y === 1)    return 3;
    else if (X === 1 && Y === maxY)    return 8;
    else if (X === maxX && Y === maxY) return 11;
    else if (Y === 1)                  return 1;
    else if (X === 1)                  return 4;
    else if (X === maxX)               return 7;
    else if (Y === maxY)               return 9;
    else if (this.isStar(X, Y))        return 6;
    else                               return 5;
  },

  isStar: function(X, Y) {
    const size = this.board.W;

    if (this.board.W !== this.board.H) {
      return false;
    }

    if (size === 9) {
      if (X === 5 && Y === 5) {
        return true;
      }
    } else if (size === 13) {
      if ((X === 4 || X === 10) && (Y === 4 || Y === 10) || (X === 7 && Y === 7)) {
        return true;
      }
    } else if (size === 19) {
      if ((X === 4 || X === 10 || X === 16) && (Y === 4 || Y === 10 || Y === 16)) {
        return true;
      }
    }
    return false;
  },
});

//----------------//
// 碁石グループのクラス //
//----------------//
phina.define("Stones", {
  superClass: "DisplayElement",

  init: function(board) {
    this.superInit({
      width: board.width - (board.padding[1] + board.padding[3]),
      height: board.height - (board.padding[0] + board.padding[2]),
    });
    const stones = this;
    const stoneShape = StoneShape(board);

    // 着手イベント設定
    this.setOrigin(0, 0).setInteractive(true)
        .addEventListener("pointend", function(e){
          const X = Math.ceil((e.pointer.x - board.padding[3]) / board.stoneSize),
                Y = Math.ceil((e.pointer.y - board.padding[0]) / board.stoneSize);
          board.move(X, Y);
        });

    // デバイスがモバイルではない場合
    if (!phina.isMobile()) {
      // 半透明の碁石を盤外にセットしておき、カーソルを追尾するようにする
      this.translucentStone = Sprite(stoneShape.canvas, board.stoneSize, board.stoneSize);
      this.translucentStone.setPosition(-100, -100).setFrameIndex(board.turn)
                           .setOrigin(0, 0).addChildTo(this).$set("alpha", 0.4);

      // カーソルが碁盤の線から出たら見えない位置へ移動する
      this.addEventListener("pointout", function(){
            this.translucentStone.setPosition(-100, -100);
          });

      // pointoutイベントは発火しないことがあるのでCanvasElementにも設定する。
      board.app.canvas.domElement.addEventListener("mouseout", function(){
        stones.translucentStone.tweener.clear().wait(1).to({x: -100, y:-100}, 1);
      });
    }

    this.sprites = [];

    // 碁石Spriteを生成して全ての座標に配置する
    for (let Y = 1; Y <= board.H; Y++) {
      for (let X = 1; X <= board.W; X++) {
        const Z = (board.W + 2) * Y + X,
              x = board.stoneSize * (X - 1),
              y = board.stoneSize * (Y - 1);

        const stone = Sprite(stoneShape.canvas, board.stoneSize, board.stoneSize)
                      .setPosition(x, y).setFrameIndex(0).setOrigin(0, 0)
                      .setInteractive(true).addChildTo(this);

        this.sprites[Z] = stone;

        // 半透明碁石の追尾設定
        if (!phina.isMobile()) {
          stone.addEventListener("pointover", function(){
            stones.translucentStone.setPosition(x, y);
          });
        }
      }
    }
  },

  // 着手フラグに応じた音を鳴らす
  playSound: function(flag) {
    switch (flag) {
      case -1:
      case -2:
      case -3: return;
      case 0 : SoundManager.play('stone1');      break;
      case 1 : SoundManager.play('capture1');    break;
      case 2 : SoundManager.play('capture2');    break;
      case 3 : SoundManager.play('capture3');    break;
      default: SoundManager.play('captureMany'); break;
    }
  },

  // 石を消す処理
  removeStones: function(place) {
    for (let i = 0; i < place.length; i++) {
    for (let j = 0; j < place[i].length; j++) {
      const index = place[i][j];
      const stone = this.sprites[index];
      stone.tweener.clear().to({alpha: 0}, 300, "swing").call(function(){
        stone.setFrameIndex(SPACE);
        stone.alpha = 1;
      });
    }
    }
  },
});
