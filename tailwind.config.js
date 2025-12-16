/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Adiciona classes dinâmicas ao safelist para garantir que o Tailwind as inclua no build
	  safelist: [
	    'bg-red-100', 'text-red-800',
	    'bg-blue-100', 'text-blue-800',
	    'bg-green-100', 'text-green-800',
	    'bg-yellow-100', 'text-yellow-800',
	    'bg-purple-100', 'text-purple-800',
	    'bg-pink-100', 'text-pink-800',
	    'bg-indigo-100', 'text-indigo-800',
	    'bg-teal-100', 'text-teal-800',
	    'bg-orange-100', 'text-orange-800',
	    'bg-cyan-100', 'text-cyan-800',
	    'bg-lime-100', 'text-lime-800',
	    'bg-fuchsia-100', 'text-fuchsia-800',
	  ],
}
