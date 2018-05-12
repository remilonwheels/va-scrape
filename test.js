let n = 0;
const times = 5;

function ayo() {
  const self = this;
  self.interval = setInterval(() => {
    console.log('yo')
    n++;

    if(n >= times) {
      clearInterval(self.interval);
    }
  }, 1000)
}


ayo()