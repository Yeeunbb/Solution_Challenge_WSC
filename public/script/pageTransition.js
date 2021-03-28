gsap.registerPlugin(ScrollToPlugin);

let tl = gsap.timeline();

const btnOptions = [{
        btnSelector: "#pathToBeforeTest",
        pageSelector: ".before_test",
        offsetY: 0
    },
    {
        btnSelector: "#toAfterTest",
        pageSelector: ".after_test",
        offsetY: 0
    },
    {
        btnSelector: "#pathToAfterTest",
        pageSelector: ".after_test",
        offsetY: 0
    },
    {
        btnSelector: "#backToTop",
        pageSelector: "#main_top",
        offsetY: 0
    },
    {
        btnSelector: "#pathToTop",
        pageSelector: "#main_top",
        offsetY: 0
    },
    {
        btnSelector: "#pathToBottom",
        pageSelector: "#main_bottom",
        offsetY: 0
    },
    {
        btnSelector: "#pathToMiddle",
        pageSelector: "#main_middle",
        offsetY: 0
    }
]

btnOptions.forEach(({ btnSelector, pageSelector, offsetY }) => {
    addPageTransition(btnSelector, pageSelector, offsetY);
})


const page = [".top", "#main_middle", "#main_bottom", ".before_test", ".after_test"];

page.forEach(p => {
    if (p === ".top") {
        if (document.querySelector(".top").clientHeight > window.height)
            document.querySelector(p).style.height = "auto";
    } else document.querySelector(p).style.height = window.innerHeight + 'px';
})