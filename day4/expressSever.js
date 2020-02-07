const express = require('express') //express.js
const app = express()
var request = require('request')

var mysql = require('mysql')
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root', // 접속할 db계정
  password : '1234', // db계정 비밀번호
  database : 'fintech', // 사용할 데이터베이스
  port : "3306"
});

var tokenKey = "fintech202020!#abcd"
var jwt = require('jsonwebtoken'); // npm install jsonwebtoken
var auth = require('./lib/auth'); // 미들웨어 사용. 토큰인증 모듈

connection.connect();

app.set('views', __dirname + '/views'); //렌더링 할 파일이 어디에 위치한지
app.set('view engine', 'ejs'); //ejs를 view engine으로 사용

app.use(express.static(__dirname + '/public')); //디자인, 프론트앤드js, 이미지 파일 등 정적파일 저장
app.use(express.json());
app.use(express.urlencoded({extended:false}));

app.get('/signup', function(req, res){
  res.render('signup');
})

app.get('/login', function(req, res){
  res.render('login');
})

app.get('/main', function(req, res){
  res.render('main');
})

app.get('/balance', function(req, res){
  res.render('balance');
})

app.get('/qrcode',function(req, res){
  res.render('qrcode');
})

app.get('/qrReader', function(req, res){
  res.render('qrReader')
})

// Callback URL
app.get('/authResult', function(req, res){
  /* 2.1.1. 사용자 인증 API */
  var authCode = req.query.code; // authorization_code(사용자 인증 성공시 반환되는 코드)
  console.log(authCode);

  /* 2.1.2. 사용자 토큰발급 API */
  var option = {
    method : "POST",
    url : "https://testapi.openbanking.or.kr/oauth/2.0/token",
    headers : {
      'Content-Type' : "application/x-www-form-urlencoded; charset=UTF-8"
    },
    form : {
        code : authCode,
        client_id : 'ofN612I9As9WtydxSIL6j8j0tiA0xrDg46ZgdrRA',
        client_secret : 'NqqNLvVShFYzZOU3S1j8eLe5nMAdgptuYlLFPryK',
        redirect_uri : 'http://localhost:3000/authResult',
        grant_type : 'authorization_code'
    }
  }
  // 사용자인증 API를 통하여 획득한 authCode를 이용하여 오픈뱅킹에 Access Token을 요청한다.
  request(option, function (error, response, body) {
    // accessToken, refreshToken, userSeqNo값이 회원가입창에 자동으로 입력
    // string으로 온 accessToken을 nodejs에서 사용할 수 있게 오브젝트로 바꿈
    var parseData = JSON.parse(body);
    // 새로운 창을 열어서 accessToken, refreshToken, userSeqNo값을 확인
    // 자식창 데이터 처리
    res.render('resultChild',{data : parseData})
  });
})

app.get('/authTest',auth,function(req,res){
  res.json("메인 컨텐츠")
})


//------------------ post 기능 ----------------//
/* 회원가입 */
app.post('/signup', function(req, res){
  var userName = req.body.userName
  var userEmail = req.body.userEmail
  var userPassword = req.body.userPassword
  var userAccessToken = req.body.userAccessToken
  var userRefreshToken = req.body.userRefreshToken
  var userSeqNo = req.body.userSeqNo
   
  // postman으로 날리면 console창에 찍힌다.

  var sql = "INSERT INTO user (email, password, name, accesstoken, refreshtoken, userseqno) VALUES (?,?,?,?,?,?)"
  connection.query(sql,[userEmail, userPassword, userName, userAccessToken, userRefreshToken, userSeqNo], function (err, results, fields) {
    if(err){
      console.error(err);
      throw err;
    }
    else {
      res.json('회원가입 성공');
    }
  });
})

/* 로그인 */
app.post('/login', function(req, res){
  var userEmail = req.body.userEmail;
  var userPassword =req.body.userPassword;
  var sql = "SELECT * FROM user WHERE email = ?"

  connection.query(sql,[userEmail], function(err, results){
    if(err){
      console.error(err);
      throw err;
    }
    else {
      if(results.length == 0){
        res.json("미등록 회원")
      }
      else {
        if(userPassword == results[0].password){
          // 서비스에 접근하기 위한 토큰. accessToken과 발행주체가 다르다
          // jwt는 우리 서비스에 대한 토큰. 금융위와는 조금 다르다
          jwt.sign(
            {
                userName : results[0].name,
                userId : results[0].id,
                userEmail : results[0].email
            },
            tokenKey,
            {
                expiresIn : '10d',
                issuer : 'fintech.admin',
                subject : 'user.login.info'
            },
            function(err, token){
                console.log('로그인 성공', token)
                res.json(token)
            }
          )
        }
        else {
          res.json("비밀번호 불일치")
        }
      }
    }
  })
})

/* 계좌목록 가져오기 */
// 사용자 인증정보 활용 요청
app.post('/list',auth, function(req, res){
  var user = req.decoded;
  var sql = "SELECT * FROM user WHERE id = ?"
  
  connection.query(sql,[user.userId], function (err, results, fields) {
    if(err){
      console.error(err);
      throw err;
    }
    else {
      console.log(results);
      var option = {
        method : "GET",
        url : "https://testapi.openbanking.or.kr/v2.0/user/me",
        headers : {
          //db에서 날아오는 값(토큰)이라 value 변수명을 db랑 맞춰줘야한다.
          'Authorization' : "Bearer " + results[0].accesstoken
        },
        qs : {
          user_seq_no : results[0].userseqno
        }
      }
      request(option, function (error, response, body) {
        var parseData = JSON.parse(body);
        res.json(parseData);
      });
    }
  });
})

/* 2.3.1. 잔액조회 API */
app.post('/balance', auth, function(req, res){ //auth로 허용된 사용자만 걸러냄
  var user = req.decoded;   // DB에서 accessToken을 가져오기위한 것
  console.log(user.userName + "접속하여 잔액조회를 합니다.");
  var finusenum = req.body.fin_use_num
  
  // 거래고유번호가 자동으로 생성되도록 설정
  var countnum = Math.floor(Math.random() * 1000000000) + 1;
  var transId = "T991599190U" + countnum;
  
  var sql = "SELECT * FROM user WHERE id = ?"
  connection.query(sql,[user.userId], function (err, results, fields) {
    var option = {
      method : "GET",
      url : "https://testapi.openbanking.or.kr/v2.0/account/balance/fin_num",
      // 헤더에 토큰 삽입
      headers : {
        'Authorization' : "Bearer " + results[0].accesstoken
      },
      // 쿼리 스트링
      qs : {
        bank_tran_id : transId,
        fintech_use_num : finusenum,
        tran_dtime : "20200205172120"
      }
    };
    request(option, function (error, response, body) {
      var parseData = JSON.parse(body);
      res.json(parseData);
    });
  });
})

/* 2.3.2. 거래내역조회 API */
app.post('/transactionlist',auth, function(req, res){
  console.log(req);
  var user = req.decoded;
  console.log(user.userName + "접속하여 잔액조회를 합니다.");
  var finusenum = req.body.fin_use_num
  console.log(finusenum);
  
  var countnum = Math.floor(Math.random() * 1000000000) + 1;
  var transId = "T991599190U" + countnum;
  
  var sql = "SELECT * FROM user WHERE id = ?"
  connection.query(sql,[user.userId], function (err, results, fields) {
    var option = {
      method : "GET",
      url : "https://testapi.openbanking.or.kr/v2.0/account/transaction_list/fin_num",
      headers : {
        'Authorization' : "Bearer " + results[0].accesstoken
      },
      qs : {
        bank_tran_id :  transId,
        fintech_use_num : finusenum,
        inquiry_type : 'A',
        inquiry_base : 'D',
        from_date : '20190101',
        to_date : '20190101',
        sort_order : 'D',
        tran_dtime : "20200205172120"
      }
    };
    
    request(option, function (error, response, body) {
      var parseData = JSON.parse(body);
      res.json(parseData);
    });
  });
})

/* 2.5.1. 출금이체 API */
app.post('/withdraw',auth, function(req, res){
  var user = req.decoded;
  console.log(user);
  var finusenum = req.body.fin_use_num
  var amount = req.body.amount
  var countnum = Math.floor(Math.random() * 1000000000) + 1;
  var transId = "T991599190U" + countnum;
  var sql = "SELECT * FROM user WHERE id = ?"
  connection.query(sql,[user.userId], function (err, results, fields) {
        var option = {
            method : "post",
            url : "https://testapi.openbanking.or.kr/v2.0/transfer/withdraw/fin_num",
            headers : {
                Authorization : "Bearer " + results[0].accesstoken
            },
            json : {
                "bank_tran_id": transId, //은행거래 고유번호
                "cntr_account_type": "N", //N:계좌, C:계정
                "cntr_account_num": "7832932596", //계좌번호
                "dps_print_content": "쇼핑몰환불",
                "fintech_use_num": "199159919057870978715901", //출금계좌핀테크이용번호
                "wd_print_content": "쇼핑몰환불",
                "tran_amt": amount, //거래금액
                "req_client_fintech_use_num" : "199159919057870978715901", //요쳥고객핀테크이용번호
                "tran_dtime": "20190910101921",
                "req_client_name": "서민지",
                "req_client_num" : "7832932596",
                "transfer_purpose" : "TR",
                "recv_client_name": "서민지",
                "recv_client_bank_code": "097",
                "recv_client_account_num": "7832932596"
            }
        }
        request(option, function (error, response, body) {
            console.log(body);
            var resultObject = body;
            if(resultObject.rsp_code == "A0000"){
              //예외처리
                res.json(1);
            } 
            else {
                res.json(resultObject.rsp_code)
            }

        });

  });
})
/* 2.5.2. 입금이체 API */ 
// 2-legged방식으로 만들어보기

app.listen(3000)