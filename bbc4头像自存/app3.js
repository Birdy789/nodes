const express = require('express')
const fs = require('fs')
const exp = require('constants')
const cookieParser = require('cookie-parser')
const escape = require('lodash/escape') // 防止 xss攻击 特别是用户要提交展示的东西

const port = 8008
const app = express()

const users = loadfile("./users.json")// []
const posts = loadfile("./posts.json")
const comments = loadfile('./comments.json')

function loadfile(file) {
  try {
    var content = fs.readFileSync(file)
    return JSON.parse(content)
  } catch (e) {
    return []
  }
}

setInterval(() => { //每隔5秒把数据写入磁盘文件
  fs.writeFileSync("./users.json", JSON.stringify(users, null, 2)) //缩进2个空格
  fs.writeFileSync("./posts.json", JSON.stringify(posts, null, 2))
  fs.writeFileSync("./comments.json", JSON.stringify(comments, null, 2))
  console.log('save')
}, 10000)

app.use((req, res, next) => {
  console.log(req.method, req.url)
  next()
})







app.use(cookieParser('cookie sign secert'))//  要带上 cookie签名的密码
app.use(express.json())//解析带json 类型 的请求 
app.use(express.urlencoded()) // 解析带urlencoded 的请求 
// app.use(express.static(__dirname + '/static'))
// Content-Type: application/x-www-form-urlencoded
// { name: 'jiahui', email: 'ddf', password: '1224' }

app.use((req, res, next) => {
  if (req.signedCookies.loginUser) {
    req.isLogin = true
  } else {
    req.isLogin = false
  }
  next()
})


app.get('/', (req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=UTF-8')
  var page = Number(req.query.page || 1)
  var pageSize = 5
  var startIdx = (page - 1) * pageSize
  var endIdx = startIdx + pageSize
  var pagePosts = posts.slice(startIdx, endIdx)

  if (pagePosts.length == 0) {
    res.end('no this page')
    return
  }

  res.end(`
  <h1>BBS</h1>
  <div>
  ${req.isLogin ?
      ` <a href="/post">发贴</a>
    <a href="/logout">登出</a>`:

      `<a href="/login">登陆</a>
    <a href="/register">注册</a>`
    } 
    </div>
  <ul>
   ${pagePosts.map(post => {//  ${posts.map(post => {
      return `
       <li>
       <a href ='/post/${post.id}'>${escape(post.title)} </a> <span> by ${post.postedBy ? post.postedBy : '未知用户'}</span>
       </li>
       `
    }).join('\n')
    }
  </ul>

  <p>
  <a href="/?page=${page - 1}">上一页</a>
  <a href="/?page=${page + 1}">下一页</a>
</p>

`)
})


//合并注册
app.route('/register')
  .get((req, res, next) => {
    res.sendFile(__dirname + '/static/register.html')
  })
  .post((req, res, next) => {
    //console.log(req.body) //用户提交上来的东西挂到req.body 上 （请求体？） 已经被urlencoded()中间件处理了
    var regInfo = req.body

    var USERNAME_RE = /^[0-9a-z_]+$/i // 规范用户名 防止有 <sctipt>等
    if (!USERNAME_RE.test(regInfo.name)) {
      res.status(400).end('username is invalid ')
    } else if (users.some(it => it.name == regInfo.name) || users.some(it => it.email == regInfo.email)) {
      res.status(400).end(' username or email has exists...')
    } else if (regInfo.password == 0) {
      res.status(400).end(' password can not be empty ')
    } else {
      regInfo.id = users.length
      users.push(req.body)
      res.end('register success')
    }

  })
//登录
app.route('/login')
  .get((req, res, next) => {
    // res.sendFile(__dirname + '/static/login.html') // 要注入referer  就要用后端返回页面，不要前端页面
    res.setHeader('Content-Type', 'text/html; charset=UTF-8')
    res.end(`
    <h1>登陆</h1>
    <form action="/login" method="POST">
    <div>Username: <input type="text" name="name"></div>
    <div>Password: <input type="password" name="password"></div>
    <input hidden name='return_to' value="${req.headers.referer || '/'}"></input> // 随表单一起提交post
    <br>
    <button>登陆</button>
    </form>
    `)
  })
  .post((req, res, next) => {
    var regInfo = req.body
    var user = users.find(it => it.name == regInfo.name) && users.find(it => it.password == regInfo.password)
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
    res.sendFile(__dirname + '/static/post.html')
    console.log(__dirname, 1111) //C:\Users\birdy\Desktop\node\bbc 1111  当前文件夹地址/当前模块的目录名
  })
  .post((req, res, next) => {
    var postInfo = req.body
    var userName = req.signedCookies.loginUser // 如果没有登录，读取到undefine

    if (userName) {
      postInfo.timestamp = new Date().toISOString()
      postInfo.id = posts.length
      postInfo.postedBy = userName
      posts.push(postInfo)
      // res.end('post success,this post id is:' + postInfo.id)
      res.redirect('/post/' + postInfo.id)
    } else {
      res.end('401 not login')
    }
  })


app.get('/post/:id', (req, res, next) => {
  var postId = req.params.id
  var post = posts.find(it => it.id == postId)
  if (post) {
    var postComments = comments.filter(it => it.postId == postId)
    res.setHeader('Content-Type', 'text/html; charset=UTF-8')

    res.end(` 
    <div>
     ${req.isLogin ?
        ` <a href="/post">发贴</a>
          <a href="/logout">登出</a>`:

        `<a href="/login">登陆</a>
         <a href="/register">注册</a>`
      } 
     </div>
     <h2>${post.title}</h2> 
     <fieldset>${post.content}</fieldset> 
     ${postComments.map(it => {
        return `
        <fieldset>
        <legend>${escape(it.commentBy)}</legend>
        <p>${escape(it.content)}</p>
        </fieldset>
      `
      }).join('\n')
      }

     ${req.isLogin ?
        ` <hr>
     <form action="/comment/post/${postId}" method="POST">
      <div>发表评论 </div>
      <textarea name="content" rows="10" cols="30"></textarea>
      <hr>
      <div><button>提交</button></div>
     </form>`: `<p>想发表评论？请 <a href="/login">登陆</a>`
      }
      `

    )
  } else {
    res.end('404 post not found')
  }
})


//向帖子发表评论，id为帖子编号
app.post('/comment/post/:id', (req, res, next) => {
  if (req.isLogin) {
    var comment = req.body
    comment.timestamp = new Date().toISOString()
    comment.postId = req.params.id
    comment.commentBy = req.signedCookies.loginUser

    comments.push(comment)

    res.redirect(req.headers.referer || '/')
  } else {
    res.end('not login')
  }
})


app.get('/logout', (req, res, next) => {
  res.clearCookie('loginUser')
  // res.redirect('/login')
  res.redirect(req.headers.referer || '/')
})


app.listen(port, () => {
  console.log('listing', port)
})
