const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const { runInNewContext } = require('vm');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const session = require('express-session');
// let port = 8080;

//Cloud Firestore 초기화
var admin = require("firebase-admin");
var serviceAccount = require("./wsc-solutionchallenge-firebase-adminsdk-68gi6-f4eb7752e7.json");
const { firestore } = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

//middleware
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.use(cookieParser());
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(session({
    secret: '@#@$MYSING#@$#$',
    resave: false,
    saveUninitialized: true
}));

//set socket communication
io.on("connection", function(socket) {
    console.log("connected!!!");
});

//main page
app.get('/', async function(req, res) {
    //feedback chart에 필요한 data db에서 읽어옴
    const userRef = db.collection("test").doc("user");
    const userDoc = await userRef.get();
    const scoreRef = db.collection("test").doc("score");
    const scoreDoc = await scoreRef.get();
    var count = userDoc.data();
    var score = scoreDoc.data();

    //user의 data 읽어옴
    var sess = req.session;
    var nickname = sess.nick;
    var beforeScore = 'no';
    var afterScore = 'no';
    var wrongBefore;
    var wrongAfter;
    var nick = '사용자';
    if (nickname) {
        const userData = await getDataByNickname(nickname);
        beforeScore = userData.before;
        afterScore = userData.after;
        wrongBefore = userData.wrongBefore;
        wrongAfter = userData.wrongAfter;
        nick = userData.nickname;
    }
    console.log(beforeScore);
    console.log(afterScore);
    console.log(wrongBefore);
    console.log(wrongAfter);
    console.log(nick);

    // lang 쿠키 설정
    res.cookie("lang", "kr");

    res.render('index', {
        Count: count,
        Score: score,
        Nickname: nick,
        WrongBefore: wrongBefore,
        WrongAfter: wrongAfter,
        BeforeScore: beforeScore,
        AfterScore: afterScore
    });
});

//main page
app.get('/en', async function(req, res) {
    //feedback chart에 필요한 data db에서 읽어옴
    const userRef = db.collection("test").doc("user");
    const userDoc = await userRef.get();
    const scoreRef = db.collection("test").doc("score");
    const scoreDoc = await scoreRef.get();
    var count = userDoc.data();
    var score = scoreDoc.data();

    //user의 data 읽어옴
    var sess = req.session;
    var nickname = sess.nick;
    var beforeScore = 'no';
    var afterScore = 'no';
    var wrongBefore;
    var wrongAfter;
    var nick = 'You';
    if (nickname) {
        const userData = await getDataByNickname(nickname);
        beforeScore = userData.before;
        afterScore = userData.after;
        wrongBefore = userData.wrongBefore;
        wrongAfter = userData.wrongAfter;
        nick = userData.nickname;
    }
    console.log(beforeScore);
    console.log(afterScore);
    console.log(wrongBefore);
    console.log(wrongAfter);
    console.log(nick);

    // lang 쿠키 설정
    res.cookie("lang", "en");

    res.render('en_index', {
        Count: count,
        Score: score,
        Nickname: nick,
        WrongBefore: wrongBefore,
        WrongAfter: wrongAfter,
        BeforeScore: beforeScore,
        AfterScore: afterScore
    });
});

//nickname form 제출 (POST)
app.post('/nickname', async function(req, res) {
    var nickname = req.body.nick;
    var sess = req.session;
    var check = await checkOverlap(nickname);
    //닉네임 등록 여부 확인
    if (sess.check == "registered") {
        res.json({ msg: "registered" });
    } else {
        //입력한 닉네임에 대한 중복 확인
        if (check == "overlap") { //중복
            res.json({ msg: "overlap" });
        } else { //중복되지 않음
            sess.nick = nickname; //user의 닉네임
            sess.check = "registered"; //닉네임 등록 여부
            res.json({ msg: "fine" });
        }
    }
});

//before test 제출 (POST)
app.post('/before', async function(req, res) {
    //세션 확인하여 버튼을 누른 사용자의 닉네임 저장 및 데이터 읽어옴
    var sess = req.session;
    var nickname = sess.nick;
    var check = sess.check; //닉네임 등록 여부
    //닉네임 등록이 안된 경우
    if (check != "registered") {
        res.json({ msg: "notRegistered" });
    } else {
        const userData = await getDataByNickname(nickname);
        //before test를 제출할 수 있는 경우(처음 제출하는 경우)
        if (userData.before == 'no') {
            //답안지 받아옴
            var ans = [
                req.body.answer1, req.body.answer2, req.body.answer3, req.body.answer4,
                req.body.answer5, req.body.answer6, req.body.answer7, req.body.answer8,
                req.body.answer9, req.body.answer10
            ];
            var solution = ["장애인", "5%", "9", "X", "X", "X", "장애인 차별금지법", "X", "X", "배리어프리 영화"]; //해답
            var wrong = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; //틀린 번호 저장하는 배열
            //채점
            var result = 0;
            for (var i = 0; i < 10; i++) {
                if (ans[i] === solution[i])
                    result++;
                else
                    wrong[i] = 1;
            }

            //user의 before test 점수 및 틀린 번호 저장한 배열 update
            updateData(nickname, "before", result, wrong);
            res.json({ msg: "fine" });
        }
    }
});

//after test 제출 (POST)
app.post('/after', async function(req, res) {
    //세션 확인하여 버튼을 누른 사용자의 닉네임 저장 및 데이터 읽어옴
    var sess = req.session;
    var nickname = sess.nick;
    var check = sess.check; //닉네임 등록 여부
    //닉네임 등록이 안된 경우
    if (check != "registered") {
        res.json({ msg: "notRegistered" });
    } else {
        const userData = await getDataByNickname(nickname);
        //before test를 보지 않고, after test를 제출한 경우
        if (userData.before == 'no') {
            res.json({ msg: "yetBefore" });
        }
        //after test를 제출할 수 있는 경우
        else if (userData.after == 'no') {
            //답안지 받아옴
            var ans = [
                req.body.answer1, req.body.answer2, req.body.answer3, req.body.answer4,
                req.body.answer5, req.body.answer6, req.body.answer7, req.body.answer8,
                req.body.answer9, req.body.answer10
            ];
            var solution = ["장애인", "5%", "9", "X", "X", "X", "장애인 차별금지법", "X", "X", "배리어프리 영화"]; //해답
            var wrong = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; //틀린 번호 저장하는 배열
            //채점
            var result = 0;
            for (var i = 0; i < 10; i++) {
                if (ans[i] === solution[i])
                    result++;
                else
                    wrong[i] = 1;
            }

            //user의 after test 점수 및 틀린 번호 저장한 배열 update
            updateData(nickname, "after", result, wrong);
            res.json({ msg: "fine" });
            //before, after test 점수 저장
            var beforeScore = userData.before;
            var afterScore = result;
            //db update후, chart에 반영할 data 읽어오기
            getData(beforeScore, afterScore);
        }
    }
});

//after test 다시보기 (POST)
app.post('/again', async function(req, res) {
    var sess = req.session;
    var nickname = sess.nick;
    const userData = await getDataByNickname(nickname);
    var beforeScore = userData.before;
    var afterScore = userData.after;
    //chart에 반영했던 data 되돌리기
    revertData(beforeScore, afterScore);

    //user의 after test 점수 및 틀린 번호 저장한 배열 update(초기화)
    var result = 'no';
    var wrong = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; //틀린 번호 저장하는 배열
    updateData(nickname, "after", result, wrong);
    res.json({ msg: "again" });
});

//user nickname 중복확인 및 처리
async function checkOverlap(nickname) {
    var check = "";
    const userRef = db.collection("user");
    const snapshot = await userRef.where('nickname', '==', nickname).get();
    if (!snapshot.empty) { //중복인 경우
        check = "overlap";
    }
    if (check != "overlap") { //중복이 아닌 경우 입력된 nickname으로 user data set
        userRef.doc().set({
            nickname: nickname,
            after: "no",
            before: "no",
            wrongBefore: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            wrongAfter: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        });
        return "fine";
    }
    return check;
}

//인자로 전달된 nickname에 해당하는 user의 데이터 읽어오기
async function getDataByNickname(nickname) {
    var data;
    const userRef = db.collection("user");
    const snapshot = await userRef.where('nickname', '==', nickname).get();
    snapshot.forEach((doc) => {
        data = doc.data();
    });
    return data;
}

//유저의 where(before of after)에 해당하는 테스트의 틀린 번호 update
async function updateData(nickname, where, score, wrong) {
    var docID;
    const userRef = db.collection("user");
    const snapshot = await userRef.where('nickname', '==', nickname).get();
    snapshot.forEach((doc) => {
        docID = doc.id;
    });
    if (where == "before") {
        userRef.doc(docID).update({ before: score, wrongBefore: wrong });
    } else if (where == "after") {
        userRef.doc(docID).update({ after: score, wrongAfter: wrong });
    }
}

//user count update
async function updateCount(type) {
    //update db test user count(1씩 증가)
    const userRef = db.collection("test").doc("user");
    if (type == 'plus') {
        await userRef.update({
            count: admin.firestore.FieldValue.increment(1)
        });
    } else if (type == 'minus') {
        await userRef.update({
            count: admin.firestore.FieldValue.increment(-1)
        });
    }
}

//점수분포 및 상승 여부 update
async function updateScore(beforeScore, afterScore, type) {
    //점수 분포 update
    const scoreIncrease = db.collection("test").doc("score");
    if (beforeScore == 0) {
        if (type == 'plus')
            await scoreIncrease.update({ b0: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b0: admin.firestore.FieldValue.increment(-1) });
    } else if (beforeScore == 1) {
        if (type == 'plus')
            await scoreIncrease.update({ b1: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b1: admin.firestore.FieldValue.increment(-1) });
    } else if (beforeScore == 2) {
        if (type == 'plus')
            await scoreIncrease.update({ b2: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b2: admin.firestore.FieldValue.increment(-1) });
    } else if (beforeScore == 3) {
        if (type == 'plus')
            await scoreIncrease.update({ b3: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b3: admin.firestore.FieldValue.increment(-1) });
    } else if (beforeScore == 4) {
        if (type == 'plus')
            await scoreIncrease.update({ b4: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b4: admin.firestore.FieldValue.increment(-1) });
    } else if (beforeScore == 5) {
        if (type == 'plus')
            await scoreIncrease.update({ b5: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b5: admin.firestore.FieldValue.increment(-1) });
    } else if (beforeScore == 6) {
        if (type == 'plus')
            await scoreIncrease.update({ b6: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b6: admin.firestore.FieldValue.increment(-1) });
    } else if (beforeScore == 7) {
        if (type == 'plus')
            await scoreIncrease.update({ b7: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b7: admin.firestore.FieldValue.increment(-1) });
    } else if (beforeScore == 8) {
        if (type == 'plus')
            await scoreIncrease.update({ b8: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b8: admin.firestore.FieldValue.increment(-1) });
    } else if (beforeScore == 9) {
        if (type == 'plus')
            await scoreIncrease.update({ b9: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b9: admin.firestore.FieldValue.increment(-1) });
    } else if (beforeScore == 10) {
        if (type == 'plus')
            await scoreIncrease.update({ b10: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ b10: admin.firestore.FieldValue.increment(-1) });
    }

    if (afterScore == 0) {
        if (type == 'plus')
            await scoreIncrease.update({ a0: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a0: admin.firestore.FieldValue.increment(-1) });
    } else if (afterScore == 1) {
        if (type == 'plus')
            await scoreIncrease.update({ a1: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a1: admin.firestore.FieldValue.increment(-1) });
    } else if (afterScore == 2) {
        if (type == 'plus')
            await scoreIncrease.update({ a2: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a2: admin.firestore.FieldValue.increment(-1) });
    } else if (afterScore == 3) {
        if (type == 'plus')
            await scoreIncrease.update({ a3: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a3: admin.firestore.FieldValue.increment(-1) });
    } else if (afterScore == 4) {
        if (type == 'plus')
            await scoreIncrease.update({ a4: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a4: admin.firestore.FieldValue.increment(-1) });
    } else if (afterScore == 5) {
        if (type == 'plus')
            await scoreIncrease.update({ a5: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a5: admin.firestore.FieldValue.increment(-1) });
    } else if (afterScore == 6) {
        if (type == 'plus')
            await scoreIncrease.update({ a6: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a6: admin.firestore.FieldValue.increment(-1) });
    } else if (afterScore == 7) {
        if (type == 'plus')
            await scoreIncrease.update({ a7: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a7: admin.firestore.FieldValue.increment(-1) });
    } else if (afterScore == 8) {
        if (type == 'plus')
            await scoreIncrease.update({ a8: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a8: admin.firestore.FieldValue.increment(-1) });
    } else if (afterScore == 9) {
        if (type == 'plus')
            await scoreIncrease.update({ a9: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a9: admin.firestore.FieldValue.increment(-1) });
    } else if (afterScore == 10) {
        if (type == 'plus')
            await scoreIncrease.update({ a10: admin.firestore.FieldValue.increment(1) });
        else if (type == 'minus')
            await scoreIncrease.update({ a10: admin.firestore.FieldValue.increment(-1) });
    }

    //점수의 상승이 있었을 때만 1씩 증가
    if (afterScore - beforeScore >= 0) {
        if (type == 'plus') {
            await scoreIncrease.update({
                increase: admin.firestore.FieldValue.increment(1)
            });
        } else if (type == 'minus') {
            await scoreIncrease.update({
                increase: admin.firestore.FieldValue.increment(-1)
            });
        }

    }
}

//user count data 읽어오기
async function getUserCount() {
    //test에 참여한 user count update를 await
    await updateCount('plus');
    const userRef = db.collection("test").doc("user");
    const userDoc = await userRef.get();
    return userDoc.data();
}

//score count data 읽어오기
async function getScore(beforeScore, afterScore) {
    //score update를 await
    await updateScore(beforeScore, afterScore, 'plus');
    const scoreRef = db.collection("test").doc("score");
    const scoreDoc = await scoreRef.get();
    return scoreDoc.data();
}

//firestore로부터 읽어들인 data 비동기로 저장 후, socket 통신
async function getData(beforeScore, afterScore) {
    const userCount = await getUserCount();
    const score = await getScore(beforeScore, afterScore);
    io.sockets.emit('completeAfter', { Count: userCount, Score: score });
}

//after test를 다시 보게 되었으므로, chart에 반영된 count 및 score data revert 
async function revertData(beforeScore, afterScore) {
    //count 1 감소
    await updateCount('minus');
    //기존에 before, after test에서 얻었던 점수 및 상승 여부 data 1씩 감소
    await updateScore(beforeScore, afterScore, 'minus');
}

//feedback chart에 반영되는 data 소멸 시, user collection 읽으며 data 추출하는 함수
async function getD(){
    var data;
    const dbRef = db.collection("user");
    const snapshot = await dbRef.where('after', '!=', 'no').get();
    snapshot.forEach(async function(doc){
        data = doc.data();
        await updateScore(data.before, data.after, 'plus');
        await updateCount('plus');
    });
}

const port = 3000;
server.listen(process.env.PORT || port, () => {
  console.log("app is running on port " + port);
});
//heroku 배포시 port를 지정하면 안됨.

// server.listen(port, () => {
//     console.log("app is running on port " + port);
// });
