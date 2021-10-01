const express = require('express')
const fs = require('fs')
const exp = require('constants')
const cookieParser = require('cookie-parser')
const escape = require('lodash/escape') // 防止 xss攻击 特别是用户要提交展示的东西 但模板不用escape 自动加载
const database = require('better-sqlite3')
const multer = require('multer')
const path = require('path')

const db = new database(__dirname + '/data.sqlite3');

let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname + '/uploads')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.random().toString(16).slice(2) + path.extname(file.originalname)) //Appending extension
  }
})
const upload = multer({ storage: storage })

const port = 8006
const app = express()

//app.set('view engine', 'pug')//模板默认扩展名，reander时可以不写 原 foo.pug =>foo
app.set('views', __dirname + '/templates')// 不是 ./templates!!__dirname 相当于.
app.locals.pretty = true //让pug 输出格式化过的html // 控制台容易看
// app.engine('html', require('hbs').__express)//html扩展名的模板使用hbs包来render 

app.engine('__tpl', function (filename, data, cb) {
  fs.readFile(filename, (err, content) => {
    if (err) {
      cb(err)
      return
    }
    tpl = content.toString()
    var i = 0
    var result = tpl.replace(/_+/g, function () {
      return data[i++]
    })
    cb(null, result)
  })
}
)

app.use((req, res, next) => {
  console.log(req.method, req.url)
  next()
})







app.use(cookieParser('cookie sign secert'))//  要带上 cookie签名的密码
app.use(express.json())//解析带json 类型 的请求 
app.use(express.urlencoded()) // 解析带urlencoded 的请求 
app.use(express.static(__dirname + '/static'))//响应static 下模板请求 这个path默认是'/'
app.use('/uploads', express.static(__dirname + '/uploads/')) // 用于响应用户上传的头像请求
// Content-Type: application/x-www-form-urlencoded
// { name: 'jiahui', email: 'ddf', password: '1224' }

// 判断用户是否登录的中间件
app.use((req, res, next) => {
  if (req.signedCookies.loginUser) {
    console.log(req.signedCookies.loginUser)
    req.isLogin = true
    var name = req.signedCookies.loginUser
    req.loginUser = db.prepare('SELECT * FROM users WHERE name =?').get(name)
  } else {
    req.isLogin = false
  }
  next()
})

app.get('/tpl_test', (req, res, next) => {
  res.render('aaa.__tpl', ['zhang', '2077', '1'])
})

app.get('/tpl_test2', (req, res, next) => {
  res.render('aaa.hbs', { a: 1, b: 2 })
})

app.get('/', (req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=UTF-8')
  var page = Number(req.query.page || 1)
  var pageSize = 3
  var totalPost = db.prepare('SELECT count(*) AS total FROM posts').get().total
  var totalPage = Math.ceil(totalPost / pageSize)
  var offset = (page - 1) * pageSize
  var pagePosts = db.prepare('SELECT * FROM posts JOIN users ON posts.userId = users.userId LIMIT ? OFFSET ?').all(pageSize, offset)
  if (pagePosts.length == 0) {
    res.end('no this page')
    return
  }

  res.render('home.pug', {
    isLogin: req.isLogin,
    loginUser: req.loginUser,
    pagePosts: pagePosts, // 当前页面帖子条目
    page: page, //第几页 默认 1 
    totalPage: totalPage

  })


})


//合并注册
app.route('/register')
  .get((req, res, next) => {
    // res.sendFile(__dirname + '/static/register.html')
    res.render('register.pug')
  })
  .post(upload.single('avatar'), (req, res, next) => {
    //console.log(req.body) //用户提交上来的东西挂到req.body 上 （请求体？） 已经被urlencoded()中间件处理了
    var regInfo = req.body
    var file = req.file
    console.log(regInfo, file)
    var USERNAME_RE = /^[0-9a-z_]+$/i // 规范用户名 防止有 <sctipt>等
    if (!USERNAME_RE.test(regInfo.name)) {
      res.status(400).end('username is invalid ')
    } else if (regInfo.password == 0) {
      res.status(400).end(' password can not be empty ')
    } else {

      var addUser = db.prepare('INSERT INTO users (name,password,email,avatar) VALUES(?,?,?,?)')
      var result = addUser.run(regInfo.name, regInfo.password, regInfo.email, file.filename)
      console.log(result)
      res.end('register success')
    }

  })
//登录
app.route('/login')
  .get((req, res, next) => {
    res.setHeader('Content-Type', 'text/html; charset=UTF-8')
    res.render("login.pug", {
      referer: req.headers.referer
    })


  })
  .post((req, res, next) => {
    var regInfo = req.body
    var userStmt = db.prepare('SELECT *FROM users WHERE name =? AND password=? ')
    var user = userStmt.get(regInfo.name, regInfo.password)
    // var userStmt = db.prepare(`SELECT * FROM users WHERE name = 'foo' OR 1 = 1 OR '2' = '2' AND password = 'a'`)
    // or 优先级高  永远可以登录
    if (user) {
      res.cookie('loginUser', user.name,
        {
          signed: true  //cookie-Parser() 引用后使用
          // req.cookies.loginUser
          // req.signedCookies.loginUser  签了名要这样读 （发帖时就知道时谁了）

          // maxAge: 86400000, // 相对过期时间点，多久过期，过期后浏览器会自动删除，并不再请求中带上
          // expires: new Date(), // 绝对过期时间点
          // httpOnly: true, // 只在请求时带在头里，不能通过document.cookie读到
        })
      // res.end('login success')

      res.redirect(regInfo.return_to) //请求体带有return_to 的信息 为上一页面或者不带 则回到首页

    } else {
      res.end('name or psw error')
    }

  })

//发帖
app.route('/post')
  .get((req, res, next) => {
    // res.sendFile(__dirname + '/static/post.html')
    res.render('issue-post.pug', {
      isLogin: req.isLogin,
      loginUser: req.loginUser,
    })
    console.log(__dirname, 1111) //C:\Users\birdy\Desktop\node\bbc 1111  当前文件夹地址/当前模块的目录名
  })
  .post((req, res, next) => {
    var postInfo = req.body
    var userName = req.signedCookies.loginUser // 如果没有登录，读取到undefine

    if (userName) {
      var user = db.prepare('SELECT * FROM users WHERE name = ?').get(userName)
      postInfo.timestamp = new Date().toISOString()
      postInfo.userId = user.userId

      var result = db.prepare('INSERT INTO posts (title, content, userId, timestamp) VALUES (?,?,?,?)')
        .run(postInfo.title, postInfo.content, postInfo.userId, postInfo.timestamp)
      console.log('Rowid' + result.lastInsertRowid) // 最新添加的一行帖子，发完跳到最新的去
      // res.end('post success,this post id is:' + postInfo.id)
      res.redirect('/post/' + result.lastInsertRowid)//后端跳转
      // res.end('<script>location.herf='/post/xxid'</script>')// 后端返回前端一个js ,然后前端执行跳转 

    } else {
      res.end('401 not login')
    }
  })


app.get('/post/:id', (req, res, next) => {
  var postId = req.params.id
  var post = db.prepare('SELECT * FROM posts JOIN users ON posts.userId = users.userId WHERE postId = ?').get(postId)
  // var post = db.prepare('SELECT * FROM posts WHERE postId = ?').get(postId)
  // var post = posts.find(it => it.id == postId)
  if (post) {
    // var postComments = comments.filter(it => it.postId == postId)
    var postComments = db.prepare('SELECT * FROM comments JOIN users ON comments.userId = users.userId WHERE postId = ?').all(postId)
    res.setHeader('Content-Type', 'text/html; charset=UTF-8')
    res.render('post-id.pug', {
      isLogin: req.isLogin,
      loginUser: req.loginUser,
      postId: postId,
      post: post,
      postComments: postComments,
    })

  } else {
    res.end('404 post not found')
  }
})


//向帖子发表评论，id为帖子编号
app.post('/comment/post/:id', (req, res, next) => {
  if (req.isLogin) {
    var comment = req.body
    console.log(comment)
    comment.timestamp = new Date().toISOString()
    comment.postId = req.params.id
    var user = req.loginUser
    comment.userId = user.userId
    comment.content = comment.content

    var result = db.prepare('INSERT INTO comments (content ,postId,userId,timestamp) VALUES (@content,@postId,@userId,@timestamp)')
      .run(comment)


    res.redirect(req.headers.referer || '/')
  } else {
    res.end('not login')
  }
})

// 删除评论
app.delete('/comment/:id', (req, res, next) => {
  db.prepare('DELETE FROM comments WHERE commentId =?').run(req.params.id)
  res.json({ //res.json()的作用的是把请求的返回值的转化成json的格式
    code: 0,
    mes: 'delete success'
  })
})


// 删除帖子
app.delete('/post/:id', (req, res, next) => {
  db.prepare('DELETE FROM posts WHERE postId =?').run(req.params.id)// 删除帖子后，要删关于帖子的所有评论
  db.prepare('DELETE FROM comments WHERE postId =?').run(req.params.id)
  res.json({ //res.json()的作用的是把请求的返回值的转化成json的格式
    code: 0,
    mes: 'delete success'
  })
})


app.get('/logout', (req, res, next) => {
  res.clearCookie('loginUser')
  // res.redirect('/login')
  res.redirect(req.headers.referer || '/')
})

// app.post('/upload', upload.any(), (req, res, next) => {
//   var files = req.files
//   console.log(files)
//   var urls = files.map(file => `http://localhost:8008/uploads/` + file.filename)
//   res.json(urls)
// })
app.listen(port, () => {
  console.log('listing', port)
})
