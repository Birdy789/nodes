const express = require('express')
const fs = require('fs')
const exp = require('constants')
const cookieParser = require('cookie-parser')

const port = 8008
const app = express()

const users = loadfile("./users.json")// []

const posts = loadfile("./posts.json")

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


app.get('/', (req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=UTF-8')
  res.end(`
  <h1>BBS</h1>
  <div>
  ${req.signedCookies.loginUser ?
      ` <a href="/post">发贴</a>
    <a href="/logout">登出</a>`:

      `<a href="/login">登陆</a>
    <a href="/register">注册</a>`
    } 
    </div>
  <ul>
   ${posts.map(post => {
      return `
       <li>
       <a href ='/post/${post.id}'>${post.title} </a> <span> by ${post.postedBy ? post.postedBy : '未知用户'}</span>
       </li>
       `
    }).join('\n')
    }
  </ul>

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
    if (users.some(it => it.name == regInfo.name) || users.some(it => it.email == regInfo.email)) {
      res.status(400).end('username or email has exists...')
    } else {
      regInfo.id = users.length
      users.push(req.body)
      res.end('register success')
    }

  })
//登录
app.route('/login')
  .get((req, res, next) => {
    res.sendFile(__dirname + '/static/login.html')
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
      res.end('login success')

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
    res.setHeader('Content-Type', 'text/html; charset=UTF-8')

    res.end(` 
    <div>
     ${req.signedCookies.loginUser ?
        ` <a href="/post">发贴</a>
          <a href="/logout">登出</a>`:

        `<a href="/login">登陆</a>
         <a href="/register">注册</a>`
      } 
     </div>
     <h2>${post.title}</h2>
     <fieldset>${post.content}</fieldset> 
    `)
  } else {
    res.end('404 post not found')
  }
})

app.get('/logout', (req, res, next) => {
  res.clearCookie('loginUser')
  res.redirect('/login')
})






// app.get('/register', (req, res, next) => {
//   res.sendFile(__dirname + '/static/register.html')
// })

// app.post('/register', (req, res, next) => {
//   //console.log(req.body) //用户提交上来的东西挂到req.body 上 （请求体？） 已经被urlencoded()中间件处理了
//   var regInfo = req.body
//   if (users.some(it => it.name == regInfo.name) || users.some(it => it.email == regInfo.email)) {
//     res.status(400).end('username or email has exists...')
//   } else {

//     users.push(req.body)
//     res.end('register success')
//   }

// })
app.listen(port, () => {
  console.log('listing', port)
})
