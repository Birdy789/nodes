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

setInterval(() => { //ÿ��5�������д������ļ�
  fs.writeFileSync("./users.json", JSON.stringify(users, null, 2)) //����2���ո�
  fs.writeFileSync("./posts.json", JSON.stringify(posts, null, 2))
  console.log('save')
}, 10000)

app.use((req, res, next) => {
  console.log(req.method, req.url)
  next()
})


app.use(cookieParser('cookie sign secert'))//  Ҫ���� cookieǩ��������
app.use(express.json())//������json ���� ������ 
app.use(express.urlencoded()) // ������urlencoded ������ 
// app.use(express.static(__dirname + '/static'))
// Content-Type: application/x-www-form-urlencoded
// { name: 'jiahui', email: 'ddf', password: '1224' }


app.get('/', (req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=UTF-8')
  res.end(`
  <h1>BBS</h1>
  <div>
  ${req.signedCookies.loginUser ?
      ` <a href="/post">����</a>
    <a href="/logout">�ǳ�</a>`:

      `<a href="/login">��½</a>
    <a href="/register">ע��</a>`
    } 
    </div>
  <ul>
   ${posts.map(post => {
      return `
       <li>
       <a href ='/post/${post.id}'>${post.title} </a> <span> by ${post.postedBy ? post.postedBy : 'δ֪�û�'}</span>
       </li>
       `
    }).join('\n')
    }
  </ul>

`)
})


//�ϲ�ע��
app.route('/register')
  .get((req, res, next) => {
    res.sendFile(__dirname + '/static/register.html')
  })
  .post((req, res, next) => {
    //console.log(req.body) //�û��ύ�����Ķ����ҵ�req.body �� �������壿�� �Ѿ���urlencoded()�м��������
    var regInfo = req.body
    if (users.some(it => it.name == regInfo.name) || users.some(it => it.email == regInfo.email)) {
      res.status(400).end('username or email has exists...')
    } else {
      regInfo.id = users.length
      users.push(req.body)
      res.end('register success')
    }

  })
//��¼
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
          signed: true  //cookie-Parser() ���ú�ʹ��
          // req.cookies.loginUser
          // req.signedCookies.loginUser  ǩ����Ҫ������ ������ʱ��֪��ʱ˭�ˣ�

          // maxAge: 86400000, // ��Թ���ʱ��㣬��ù��ڣ����ں���������Զ�ɾ���������������д���
          // expires: new Date(), // ���Թ���ʱ���
          // httpOnly: true, // ֻ������ʱ����ͷ�����ͨ��document.cookie����
        })
      res.end('login success')

    } else {
      res.end('name or psw error')
    }

  })

//����
app.route('/post')
  .get((req, res, next) => {
    res.sendFile(__dirname + '/static/post.html')
    console.log(__dirname, 1111) //C:\Users\birdy\Desktop\node\bbc 1111  ��ǰ�ļ��е�ַ/��ǰģ���Ŀ¼��
  })
  .post((req, res, next) => {
    var postInfo = req.body
    var userName = req.signedCookies.loginUser // ���û�е�¼����ȡ��undefine

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
        ` <a href="/post">����</a>
          <a href="/logout">�ǳ�</a>`:

        `<a href="/login">��½</a>
         <a href="/register">ע��</a>`
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
//   //console.log(req.body) //�û��ύ�����Ķ����ҵ�req.body �� �������壿�� �Ѿ���urlencoded()�м��������
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
