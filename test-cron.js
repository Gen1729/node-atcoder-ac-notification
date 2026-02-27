const cron = require('node-cron');

console.log('=== Cron動作テスト ===');
console.log(`現在時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
console.log('');

// 1分ごとに実行されるテスト
const task1 = cron.schedule('* * * * *', () => {
  console.log(`[毎分テスト] ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
}, {
  scheduled: true,
  timezone: 'Asia/Tokyo'
});

console.log('✓ 毎分実行のテストタスクを設定しました');

// 現在時刻の次の分に実行されるテスト
const now = new Date();
const nextMinute = now.getMinutes() + 1;
const nextHour = nextMinute >= 60 ? now.getHours() + 1 : now.getHours();
const adjustedMinute = nextMinute % 60;

const task2 = cron.schedule(`${adjustedMinute} ${nextHour} * * *`, () => {
  console.log(`[特定時刻テスト] ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
}, {
  scheduled: true,
  timezone: 'Asia/Tokyo'
});

console.log(`✓ ${nextHour}:${adjustedMinute.toString().padStart(2, '0')} に実行されるテストタスクを設定しました`);
console.log('');
console.log('Ctrl+Cで終了してください');
console.log('1分以内にメッセージが表示されるはずです...');

// プロセスを維持
setInterval(() => {}, 1000);
