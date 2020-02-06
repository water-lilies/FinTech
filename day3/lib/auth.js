//미들웨어
const jwt = require('jsonwebtoken')
var tokenKey = "fintech202020!#abcd"
const authMiddleware = (req, res, next) => {
   const token = req.headers['x-access-token'] || req.query.token; 
   console.error(token)
   if(!token) {
       return res.status(403).json({
           success: false,
           message: 'not logged in'
       })
   }
   const p = new Promise(   // Promise객체를 사용함으로써 verify로 토큰 검증
       (resolve, reject) => {
           jwt.verify(token, tokenKey, (err, decoded) => {
               if(err) reject(err)
               resolve(decoded)
           })
       }
   )
   const onError = (error) => {
       console.log(error);
       res.status(403).json({
           success: false,
           message: error.message
       })
   }
   p.then((decoded)=>{
       req.decoded = decoded
       next()
   }).catch(onError)
}
module.exports = authMiddleware;
