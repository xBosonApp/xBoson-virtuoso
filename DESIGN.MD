# 结构设计

> [DT] 数据结构
> [PG] 程序接口
> [HI] Http 接口, 基于 /eeb/service/
>
> 回调函数 RCB 的定义 function(err, data) 发生错误则保存在 err 中
> err:Error()


### [HI] 基于 /eeb/service/ 路径的服务

* http 服务返回一个 HttpRet: { ret:0, msg:null, data: }
* ret==0 成功否则失败, msg 保存失败原因
* 成功后 data 放置返回的数据

* /getlist 取得所有配置, extend 中保存数据库的扩展属性
  [in] t - 类型 ETL:1
  [Ou] HttpRet.data = [{rid:'rid', name:'name', extend:{} }, ... ]

* /getrc 取得一个 RunnerConfig
  [in] rid -- 要取得的任务配置的 id
  [Ou] HttpRet.data = RunnerConfig

* /newrc 创建一个基本配置
  [in] t
  [Ou] HttpRet.data = RunnerConfig

* /rename 重命名
  [in] rid, name, t, cid -- 集群id
  [Ou] HttpRet

* /delrc 删除
  [in] rid, t
  [Ou] HttpRet

* /saverc 保存一个配置好的任务
  [in] c -- RunnerConfig
  [Ou] HttpRet

* /sche_get 读取 etl 任务计划
  [in] t 必须 1, rid
  [Ou] HttpRet.data = {}

* /sche_save 保存 etl 任务计划
  [in] post
  [Ou] HttpRet

* /sche_start 启动一个 etl 计划任务
  [in] rid, t
  [Ou] HttpRet

* /sche_stop 停止一个 etl 计划任务
  [in] rid, t
  [Ou] HttpRet

* /sche_info 获取一个 etl 计划任务信息
  [in] rid, t
  [Ou] HttpRet.data = {}

* /sche_state 获取 etl 计划状态
  [in] rid -- [], t
  [Ou] HttpRet.data = { rid:{...} }

* /proglist 读取程序列表
  [in] t
  [Ou] HttpRet.data = {}

* /inittarget 得到目标的初始化配置
  [in] pid -- programID
  [Ou] HttpRet.data = {}

* /checktarget 测试一个目标的配置, 返回错误信息
  [in] tconfig - 目标配置
  [Ou] 验证出错 HttpRet.ret = 0, HttpRet.ret 放置错误信息

* /his 读取历史数据, 同时知道哪一个目标在运行
  [in] rid,
  [Ou] HttpRet.data = HistoryList

* /state 知道哪一个目标在运行
  [in] rid,
  [Ou] HttpRet.data = targetID

* /testtarget 测试运行一个目标, 没有上下文相关性
  [in] post  { tc -- targetConf , data -- 父节点运行数据 (可以空), t -- className }
  [Ou] HttpRet.data = FlowData

* /test 测试运行一个任务  (首先保存这个配置)
  [in] rid
  [Ou] HttpRet.data = FlowData

* /run 运行一个任务 (首先保存这个配置)
  [in] rid
  [Ou] HttpRet.data = FlowData

* /stop 停止一个任务
  [in] rid
  [Ou] HttpRet

* /fp_get 下载文件
  [in] tname -- 要下载的文件名, fname -- 下载的文件重命名
       fix -- 是否从固定目录取文件, 默认依据用户id取文件
       openid -- 关联用户
  [Ou] 直接从浏览器返回文件

* /fp_up 上传文件
  [in] fname -- 上传文件名, rep -- 是否覆盖原文件, false:会重命名重复文件
       openid
  [Ou] HttpRet

* /fp_del 删除文件
  [in] fname, openid
  [Ou] HttpRet

* /fp_list
  [in] fname, openid
  [Ou] HttpRet

! /getiid 返回实例 ID, 已经禁用, 敏感数据
  [in] t
  [Ou] id

* /grp_new 新建分组
  [in] n -- 分组名称
  [Ou] HttpRet

* /grp_del 删除分组
  [in] i -- 分组 id
  [Ou] HttpRet

* /grp_mod 修改分组
  [in] i -- 分组 id, n -- 新名称
  [Ou] HttpRet

* /grp_list 列出分组
  [in] pn -- 页码
  [Ou] HttpRet.data -- [{id, name}]


### [DT] RunnerConfig 保存一个流程的所有数据

{
  // 任务名称, 可重复?
  name : String
  // 不可重复的, 是数据库主键, 启动任务使用这个值
  rid : String
  // 程序所属类型 ETL:1, ESB:2, BPM:4
  className : Number
  // 集群组, 可以空
  clusterid : uuid

  offset_x : Number
  offset_y : Number
  note_text : String

  // ETL 专有, 任务计划, 以链的方式保存多个计划
  // 首个 schedule.id == rid 必须!
  schedule : { id, __next_schedule: { id, __next_schedule: {...} } }

  // 这是个所以子任务的列表(无序)
  targets: {

    // key 是这个任务的id, 与对象中的 id 属性相同
    'targetID': { // targetConfig
      tid: 'targetID' String
      tname: String

      // 执行这个任务的程序 ID
      programID: String

      // 显示配置, 这个是通用的
      disp_config: {
        // 图标
        icon: String
        // 在窗口上的位置
        x:Number y:Number
        .....
      }

      // 与程序相关的配置项, 由程序自己修改
      // 每个程序的配置项都是不同的
      // configJSON == run_config
      run_config: {
        name : '名称'
        _type : '请求类型, 用于进行非保存操作'

        bizlog : {
          // 业务日志配置是可选的, 当调用 Interactive.bizlog 时
          // 会检查这些配置是否对应, 然后写出日志
          '日志名称' : {
            desc : '日志的描述, 如触发条件'
            msg : '用户自定义消息'
            enable : false 是否启用这个条件
          }
        }
        ... 其他配置项
      }
    }
    .... 多个
  } // targets [End]


  // 任务之间的关系, 绘制器也使用这个属性来绘制图形
  dependent: {
    'targetID' : {
      // 当前节点的子节点
      child: [ 'targetID1', 'targetID2' ... ]
      // 当前节点的父节点, 如果是起始节点则为 null
      parent: [ String::'targetID' ]
    }
    .... 多个
  }
}


### [DT] History

// 历史记录对象 HistoryContent
{
  // 运行配置的引用
  runnerId: 'RunnerConfigId'
  // 正在运行的任务 id, 为 null 则这个任务正在初始化
  targetID: String
  // 这个 content 历史记录片段从主片段的起始位置
  begin: Number
  // 运行记录列表的片段, 如果没有历史记录是一个空数组
  content: [ HisContent1, HisContent2 ]
  // 当前运行状态, 定义在 core.js
  state: Number
}

// 历史记录内容 HisItem
{
  // 发生的时间
  time  : Date
  // 日志的内容
  msg   : String
  // 执行程序的 ID
  pid   : 'TargetProgramID':String
  tid   : '任务配置中的 targetID':String
  tname : '目标名称 TargetName':String
  data  : 任务相关数据
}


### [PG] FlowData 在目标之间传递数据

// 这是一个迭代器, 初始位置在 -1
// 这个迭代器与一个文件关联, 数据保持在文件中
// 所以不用担心内存溢出
// 类型在 'type-data.js' 定义
// 在 ESB 中 head 保存私有变量, data 保存用户可访问可修改变量
{
  // 返回一个数组, 数组中放置数据列名, 数组索引与列的位置对应
  getHead()
  // 返回类型的数组, 索引处的数据与 head 的位置对应
  getType()
  // 返回当前行数据的数组, 索引处的数据与 head 的位置对应,
  // 如果没有数据, 则这个方法返回 null
  getData()
  // 用数据头的名称取得当前行一个字段的数据
  getField(headname:String)
  // 取地 col 列的数据
  getField(col:Number)
  // 移动到第 row_index 行, 之后仍需要 next()
  moveto(row_index:Number)
  // 返回列名对应的列索引
  getColumn(headname)

  // 如果数据没有初始化返回 true
  isempty()
  // 返回一个和当前列相同的 data
  // 如果有 target 参数, 则设置 target 为当前 flow 相同的列
  clone(target)

  // 返回总行数
  totalrows()

  // 清除所有数据, 所有的 set 方法在有数据的时候调用都会抛出异常
  reset()
  // 设置数据列名称, 这个方法必须在 reset() 之后调用
  setHead(['col1', 'col2' ....])
  // 设置数据列类型, 这个方法必须在 setHead() 之后调用
  // type 有无是可选的
  setType(['col1', 'col2' ....])
  // 压入数据, 这个方法必须在 setHead() 之后调用
  // 这个方法不会影响读取迭代器的位置
  // ETL 支持 org_line_num 记录当前数据的原始行号
  // 或者使用数组对象的 line 属性记录行号
  push(['col1', 'col2' ....], org_line_num)

  // 如果有更多数据则返回 true, 之后可以调用 next()
  has()
  // 使迭代器进入下一行
  next();
}


### [PG] RunnerObj

* 实现在 lib/runner.js
* 运行引擎
* 引擎加载配置文件
* 引擎加载 TargetProgram, 并调度任务之间的关联
* 引擎通过 Interactive 与 TargetProgram 交互
* 如果一个任务有多个入口点以致同时运行多个路径, 一条路径出错, 全部会停止(默认)

RunnerObj 导出函数 [待定]
{
  // 启动一个任务, RCB:data 为 null
  // __ext -- 扩展参数, 用于日志等目的
  run('RunnerConfig':JSON, RCB, __limit, __is_test, __ext)

  // 停止正在运行的任务, RCB:data 为 null
  test('RunnerConfig':JSON, RCB)

  // 返回历史记录对象 HistoryList,
  // 从位置 being 共返回 length 个记录到 RCB:data
  getHistory('RunnerConfigId':String, 'being':Number, 'length':Number, RCB)
}


### [PG] Interactive

* configJSON 是 [RunnerConfig/targets/] 中的片段

{
  // 每一个运行时上下文都有一个唯一的 ID
  // 多个父节点汇聚数据到一个子节点时会用到
  runtimeid : String

  // 注册停止通知函数, 当系统收到停止命令时, 会回调
  // 所有注册的停止函数, 当函数返回后, 系统会认为程序成功停止
  // 多次注册会多次调用
  onStop('stop-handle':Function())

  // 返回给 TargetProgram 的配置
  getConfig() : return configJSON

  // 调用该方法告诉 RunnerObj 当前 TargetProgram 执行完成
  // 并把执行结果传递给 RunnerObj
  // 如果有多条分支, nextTargetID 指定下一条分支的路线
  // 如果没有分支或一条分支, 这个参数可以为空, 否则会终止并生成错误历史
  // ! 如果程序不调用这个方法, 会导致整个任务挂起
  runOver(FlowData[, nextTargetID])

  // 向父节点传播事件, 父节点是否继续传播取决于节点本身的程序
  // 事件类型在 lib/type-event.js 中定义
  sendEvent('eventname':String, 'data1':Object, 'data2':Object)
  sendError(errorObject:Error/String, sendsomedata:Object, errorcode:int)

  // 注册事件监听器, 监听器是截断式的, 在一条路线上后注册
  // 的处理器会屏蔽前一次注册的事件
  regEvent('eventname':String, 'eventHandle':Function(data:Object))

  // 向子节点传播事件
  // 事件只能被接受一次, 然后销毁, 多次发送同一个事件
  // 会保存为队列, 一旦相同名字的监听器被注册, 所有该事件的数据
  // 都会被发往处理器
  // ! 未完成 !
  posthumous('eventname':String, 'data1':Object, 'data2':Object)

  // 注册监听器, 接收由父节点发送的消息
  // ! 未完成 !
  inherit('eventname':String, 'eventHandle':Function(data:Object))

  // 产生一条历史记录
  // addhis(HisContent)  这个应该被 log() 封装
  // Data -- 可选的与消息相关的数据
  log(String[, Data:Object])

  // 产生一条业务日志, 日志名称必须在 createConfig().bizlog 中有对应项
  // 当名称无效时, 该条日志被忽略
  bizlog(name:String, data:flowData.ROW_DATA)

  // 读取要处理的数据, 通常是上一个 TargetProgram 生成的
  // 总是返回有效数据 (RunnerObj 来保证)
  getData() : return FlowData

  // 依据当前的作业类型创建 flow 数据
  createFlow() : return FlowData

  // 取得所有子节点列表, 没有子节点返回空数组
  getChildList() : return Array

  // 取得所有父节点列表, 没有子节点返回空数组
  getParentList() : return Array
}


### [PG] TargetProgram

* 目录在 lib/target/*
* 每个功能是一个文件, 导出方法给引擎使用
* 所有的方法都是可重入的

// program 导出的对象 / 方法
{
  // 程序名称
  name      : String
  // 程序标识, 不能重复
  programID : String
  // 用来修改这个程序配置的页面url, '/' == '/eeb/ui/'
  configPage: String
  // 程序分组名称
  groupName : String
  // 程序所属类型 ETL:1, ESB:2, BPM:4; 可以是两种以上
  className : Number
  // 图标, 基于 www/public/img/target-icon/ 目录
  icon : String

  // 最多允许父/子的节点数量, 不定义则不限制
  parent_max : Number
  child_max  : Number

  // 编组配置, 默认无, 与之关联的程序会自动进入配置中
  // 这些关联的程序必须同时共存, 只在主程序中配置这个属性
  group_program : [ programID1, 2 ]
  // 是否在工具栏中显示, 默认 false
  not_display : false

  // 检查配置是否有效,
  // RCB:err = { 'configname':'msg', ... } 意思是
  // configname 指明的 input 字段出现了 msg 的问题
  // 如果成功 则什么都不返回, 或者在 RCB:err 放入消息
  // 如果 RCB:err 是一个字符串, 客户端可以弹出消息
  // 返回对象中 retmessage 一定会弹出消息
  checkConfig(configJSON, RCB)

  // 初始化一个默认配置, 结果在 RCB:data
  // 配置中必须有 name , _type 属性
  createConfig(RCB)

  // 运行这个任务, limit(过时的设计) 指定一个数据限制, 程序生成的数据行
  // 不能超过这个限制, 当测试运行时, 这个参数被指定, 正式运行时总是 null
  // 测试运行时 is_test 为 true,
  run(Interactive, limit, is_test)
}


### 日志系统, 存储结构

```sql
/* for Mysql */
```
