/**
 *  Copyright 2023 Jing Yanming
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
var java = require('java-factory-lib').getJavaInstance();


module.exports.build_wsdl = build_wsdl;


//
// 转换配置到 wsdl 字符串, service_cnf 存放方法和服务结构
// opt 存放对应结构的参数类型
//
// service_cnf -- { Service: { Port: { Function,... } } }
// opt -- url, transport, services(结构与 service_cnf 相同)
// rcb -- Function(err, xml)
//
function build_wsdl(service_cnf, opt, rcb) {
  try {  
    if (!opt.url) throw new Error('must set opt.url options.');

    var QName           = java.import('javax.xml.namespace.QName');
    var OperationType   = java.import('javax.wsdl.OperationType');
    var SOAPBindingImpl = java.import('com.ibm.wsdl.extensions.soap.SOAPBindingImpl');
    var SOAPBodyImpl    = java.import('com.ibm.wsdl.extensions.soap.SOAPBodyImpl');
    var SOAPAddressImpl = java.import('com.ibm.wsdl.extensions.soap.SOAPAddressImpl');

    var UnknownExtensibilityElement
            = java.import('javax.wsdl.extensions.UnknownExtensibilityElement');
    var DocumentBuilderFactory
            = java.import('javax.xml.parsers.DocumentBuilderFactory');


    var _id         = 1;
    var tns         = opt.url;  
    var xsd         = "http://www.w3.org/2001/XMLSchema";  
    var transport   = opt.transport || "http://schemas.xmlsoap.org/soap/http";

    var docFactory  = DocumentBuilderFactory.newInstanceSync();
    var docBuilder  = docFactory.newDocumentBuilderSync();
    var doc         = docBuilder.newDocumentSync();

    var wsdlFactory = java.newInstanceSync("com.ibm.wsdl.factory.WSDLFactoryImpl");
    var definition  = wsdlFactory.newDefinitionSync();

    init_ns();
      
    var types = c_types();
    

    for (var sername in service_cnf) {
      var port_cnf    = service_cnf[sername];
      var service     = c_service(sername);

      for (var pname in port_cnf) {
        var func_cnf  = port_cnf[pname];
        var portmap   = c_porttype(pname);
        var bind      = c_binding(pname, portmap.portType);

        portmap.servicePort.setBindingSync(bind);
        service.addPortSync(portmap.servicePort);

        for (var fnname in func_cnf) {
          var msg_in  = create_message_from_cnf(sername, pname, fnname, 'in',  'Input');
          var msg_out = create_message_from_cnf(sername, pname, fnname, 'out', 'Output');

          if (msg_in || msg_out) {
            var opermap = c_operation(fnname, msg_in, msg_out);

            portmap.portType.addOperationSync(opermap.operation);
            bind.addBindingOperationSync(opermap.bindingOperation);
          }
        }
      }
    }

    xml_return();
    

    function create_message_from_cnf(sn, pn, fn, cn, mn) {
      var arg_cnf = opt.services
                 && opt.services[sn]
                 && opt.services[sn][pn]
                 && opt.services[sn][pn][fn]
                 && opt.services[sn][pn][fn][cn];

      if (arg_cnf) {
        var m_id = _id++;
        var extname = sn + '_' + pn + '_' + fn + '_' + mn;
        var pname   = fn + mn + m_id;
        var part    = c_part(pname, extname);
        var msg     = c_message(pname, [part]);
        var eles    = types.addElement(extname);

        if (arg_cnf) {
          for (var pn in arg_cnf) {
            eles.addParameter(pn, arg_cnf[pn]);
          }
        }
        return msg;
      }
    }


    function xml_return() {
      var buffer = java.newInstanceSync("java.io.StringWriter");

      var wsdlout = wsdlFactory.newWSDLWriterSync();  
      wsdlout.writeWSDLSync(definition, buffer);  

      buffer.toString(function(err, str) {
        rcb(err, str);
      });
    }


    function init_ns() {
      definition.setTargetNamespaceSync(tns);

      definition.addNamespaceSync("tns", tns);  
      definition.addNamespaceSync("xsd", xsd);  
      definition.addNamespaceSync("wsdlsoap",  "http://schemas.xmlsoap.org/wsdl/soap/");  
      definition.addNamespaceSync("soapenc11", "http://schemas.xmlsoap.org/soap/encoding/");  
      definition.addNamespaceSync("soapenc12", "http://www.w3.org/2003/05/soap-encoding");  
      definition.addNamespaceSync("soap11",    "http://schemas.xmlsoap.org/soap/envelope/");  
      definition.addNamespaceSync("soap12",    "http://www.w3.org/2003/05/soap-envelope");  
    }

    //
    // 创建 <wsdl:types>
    //
    function c_types() {
      var types = definition.createTypesSync();
      definition.setTypesSync(types);

      var schema = doc.createElementNSSync(xsd, 'schema');
      schema.setPrefixSync('xsd');
      schema.setAttributeSync('xmlns:xsd', xsd);
      schema.setAttributeSync('attributeFormDefault', 'qualified');
      schema.setAttributeSync('elementFormDefault', 'qualified');
      schema.setAttributeSync('targetNamespace', tns);

      var extEle = new UnknownExtensibilityElement();
      extEle.setRequiredSync(false);
      extEle.setElementSync(schema);
      types.addExtensibilityElementSync(extEle);
      

      return {
        types : types,

        addElement : function(_name) {
          //
          // ! 这里需要根据不同的 _type 做特殊处理, 现在写死 !
          //
          var ele = doc.createElementNSSync(xsd, "element");
          ele.setPrefixSync('xsd');
          ele.setAttributeSync('name', _name);

          var ct = doc.createElementNSSync(xsd, "complexType");
          ct.setPrefixSync('xsd');

          // all / choice / sequence
          var order = doc.createElementNSSync(xsd, 'all');
          order.setPrefixSync('xsd');

          ct.appendChild(order);
          ele.appendChild(ct);

          schema.appendChild(ele);

          return {
            addParameter : function(_pname, _ptype) {
              var tp = doc.createElementNSSync(xsd, 'element');
              tp.setPrefixSync('xsd');
              tp.setAttributeSync('name', _pname);
              tp.setAttributeSync('type', _ptype);
              order.appendChild(tp);
            }
          }
        }
      }
    }


    //
    // 创建 Part  
    // _type -- 可选的
    //
    function c_part(_name, _elename) {
      var part = definition.createPartSync();  
      part.setNameSync(_name);  
      part.setElementName(new QName(tns, _elename));
      return part;
    }


    //          
    // 创建消息（Message）  
    // 返回的 Message 需要 addPart
    // _parts -- [] 可选的
    //
    function c_message(_name, _parts) {
      var message1 = definition.createMessageSync();  
      message1.setQNameSync(new QName(tns, _name));  

      //为 message 添加 Part, 可选的
      if (_parts) {
        _parts.forEach(function(p) {
          message1.addPartSync(p);  
        });
      }

      message1.setUndefinedSync(false); 
      definition.addMessageSync(message1);  
      return message1;
    }

          
    //
    // 创建 portType, 相当于 接口或类
    // 返回的 portType 需要 addOperationSync
    // operations -- [] 可选的
    // binding -- 可选的
    //
    function c_porttype(_name, operations, binding) {
      var portType = definition.createPortTypeSync();  
      portType.setQNameSync(new QName(tns, _name));  

      if (operations) {
        operations.forEach(function(op) {
          portType.addOperationSync(op);  
        });
      }
      
      portType.setUndefinedSync(false);  
      definition.addPortTypeSync(portType);  

      //创建服务端口 port, 设置服务端口的 binding，名称，并添加SOAP地址
      var port = definition.createPortSync();  
      if (binding) port.setBindingSync(binding);  
      port.setNameSync(_name);  

      var soapAddress = new SOAPAddressImpl();  
      soapAddress.setLocationURI(opt.url);  
      port.addExtensibilityElementSync(soapAddress);  

      return {
        portType : portType,
        // 需要 setBindingSync, 如果 binding 参数为空
        servicePort : port
      }
    }


    //
    // <wsdl:operation> 元素相当于方法
    // _inputs -- message 可选的
    // _output -- message 可选的
    //
    function c_operation(_name, _input, _output) {
      var operation = definition.createOperationSync();  
      operation.setNameSync(_name);

      var bindingOperation = definition.createBindingOperationSync();   
      bindingOperation.setNameSync(_name);    

      if (_input) {
        var iname = _input.getQNameSync().getLocalPartSync();
        var input = definition.createInputSync();  
        input.setNameSync(iname);  
        input.setMessageSync(_input);  
        operation.setInputSync(input);

        //创建 SOAP body ，设置 use = "literal"  
        var soapBody1 = new SOAPBodyImpl();  
        soapBody1.setUseSync("literal");  

        var bindingInput = definition.createBindingInputSync();  
        bindingInput.setNameSync(iname);  
        bindingInput.addExtensibilityElementSync(soapBody1);  
        bindingOperation.setBindingInputSync(bindingInput);  
      }

      if (_output) {
        var oname = _output.getQNameSync().getLocalPartSync();
        var output = definition.createOutputSync();  
        output.setNameSync(oname);  
        output.setMessageSync(_output);  
        operation.setOutputSync(output);  

        var soapBody2 = new SOAPBodyImpl();  
        soapBody2.setUseSync("literal");  

        var bindingOutput = definition.createBindingOutputSync();  
        bindingOutput.setNameSync(oname); 
        bindingOutput.addExtensibilityElementSync(soapBody2);  
        bindingOperation.setBindingOutputSync(bindingOutput); 
      }

      if (_input && _output) {
        operation.setStyleSync(OperationType.REQUEST_RESPONSE);
      } else if (_input) {
        operation.setStyleSync(OperationType.ONE_WAY);
      } else if (_output) {
        operation.setStyleSync(OperationType.NOTIFICATION);
      }

      operation.setUndefinedSync(false);  

      return {
        operation : operation,
        bindingOperation : bindingOperation
      };
    }

      
    //
    // 创建绑定（binding） 相当于 接口的实例 
    // 返回的 binding 需要 addBindingOperationSync 操作
    // bindingOperation -- [] 可选的
    //
    function c_binding(_name, portType, bindingOperation) {
      var binding = definition.createBindingSync();
      binding.setQNameSync(new QName(tns, _name)); 

      //创建SOAP绑定（SOAP binding）  
      var soapBinding = new SOAPBindingImpl();  
      soapBinding.setStyleSync("document");  
      soapBinding.setTransportURISync(transport);  

      //soapBinding 是 WSDL 中的扩展元素
      //为 binding 添加扩展元素 soapBinding
      binding.addExtensibilityElementSync(soapBinding);  
      binding.setPortTypeSync(portType);  
      // binding.addBindingOperationSync(bindingOperation);  

      //这行语句很重要 ！  
      binding.setUndefinedSync(false);
      definition.addBindingSync(binding);

      return binding;
    }
      

    //
    // 创建 service
    // ports -- [] 可选的, 如果 null, 返回的 service 需要 addPortSync
    //
    function c_service(_name, ports) {
      var service = definition.createServiceSync();  
      service.setQNameSync(new QName(tns, _name));

      if (ports) {
        ports.forEach(function(p) {
          service.addPortSync(port);  
        });
      }
        
      definition.addServiceSync(service);
      return service;
    }
  
  } catch(err) {
    return rcb(err);
  }
}