export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {
    fontFamily: { playfair: ["Playfair Display","serif"], sans: ["DM Sans","sans-serif"] },
    colors: { maroon:"#741f28", gold:"#c99a43", cream:"#fffaf0" },
    boxShadow: { soft:"0 18px 60px rgba(61,35,22,.10)" }
  }},
  plugins: []
};