

module.exports = {
  show_flow : show_flow,
  showarr   : showarr
};


function show_flow(f, beginAt) {
  var head = f.getHead();
  var rownum = 0;

  f.moveto(beginAt || 0);

  showarr('head', f.getHead(), 'LINE');
  showarr('type', f.getType(), 'EXT ATTR');

  while (f.has()) {
    f.next();
    var row = f.getData();
    showarr(rownum++, row, row.line);
  }
  console.log();
}


function showarr(name, arr, ext) {
  var txt = [];
  for (var i=0; i<arr.length; ++i) {
    txt.push(arr[i]);
  }
  console.log(''+name, "::", txt.join("\t"), "\t ", ext);
}