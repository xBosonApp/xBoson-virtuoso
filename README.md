# EEB 集群节点, 流运算内核

> 在 node 0.10 下运行会出现内存溢出或进程崩溃的情况


### 安装
`npm install eeb-virtuoso-prj --save`


### 依赖
* [redis-server](http://www.redis.cn/)
* [kafka-server](http://kafka.apache.org/documentation.html)
* [zr-server](http://zr-i.com:8088/ui/login.html)
* [java](http://www.java.com/)
* [vs2012 on window](https://www.visualstudio.com/zh-cn/products/free-developer-offers-vs.aspx)
* [gcc on linux](http://gcc.gnu.org/)
* [Python27](https://www.python.org/download/releases/2.7/)
* [NPM](https://github.com/npm/npm)

> redis 安装不正确会导致运行缓慢, kafka 不是必须的 <br/>
> 可以在本地安装 web 服务器挂 zr-ui


### 程序配置

1. 本地数据存储位置
    config/config.js -- eeb_zy.local_db_dir 

2. 本地数据库配置
    config/config.js -- eeb_zy.log_db 

3. 平台引用配置
    config/config.js -- eeb_zy.port, eeb_zy.ip

4. 部分 UI 资源因自平台, 配置页面引用
    www/private/tag/setenv.htm, 
    修改 server-s 的设置, 修改 zy.g.host.ui, zy.g.host.api 的设置


### 运行

`npm start`


# ETL

# ESB

# BPM