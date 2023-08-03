import { parse } from 'svg-parser';
import parsePath from 'svg-path-parser';
import fs from 'fs';
import path from 'path';
import { transform } from '@svgr/core'
import shell from "shelljs";

const icons = fs.readdirSync("./icons")

const write = (file, data) => {
    console.log("+ "+file)
    fs.writeFileSync(file, data)
}

const remove = (file) => {
    if(fs.existsSync(file)){
        console.log("- "+file)
        fs.unlinkSync(file)
    }
}

setTimeout(async () => {
    const args = process.argv.slice(2);
    if(args[0]==='clean') {
        clean();
        return;
    }

    const kotlinVectors = []
    const androidVectors = []
    const jsVectors = []
    for (const iconFileName of icons) {
        const iconFileContents = fs.readFileSync("./icons/"+iconFileName, "utf8")
        const outputFileName = iconFileName.replaceAll(/(\.svg)/ig, "")

        console.log("Processing "+iconFileName+"...")

        const svg = parse(iconFileContents)

        kotlinVectors.push({
            name: outputFileName.replaceAll(' ', ''),
            vector: generateKotlinImageVector(outputFileName.replaceAll(' ', ''), svg)
        })

        androidVectors.push({
            name: outputFileName,
            vector: generateAndroidImageVector(outputFileName, svg)
        })

        const jsName = 'ZnUIIcon'+outputFileName
            .split(",")
            .map(it => it.replaceAll(/.+?=/g, ''))
            .join()
            .replaceAll(',', '')
            .replaceAll(' ', '')

        jsVectors.push({
            name: jsName,
            vector: await generateReactIcon(jsName, iconFileContents)
        })
    }


    clean()

    write("./output/jetpack/ZnIcons.kt",
        `
            package ru.zation
                
            import androidx.compose.material.icons.materialIcon
            import androidx.compose.material.icons.materialPath
            import androidx.compose.ui.graphics.Color
            import androidx.compose.ui.graphics.SolidColor
            import androidx.compose.ui.graphics.vector.ImageVector
            import androidx.compose.ui.graphics.vector.path
                
            object ZnIcons {
            `+
                    (kotlinVectors.map(it => {
                        return `    val `+
                            it.name
                                .split(",")
                                .map(it => it.replaceAll(/.+?=/g, ''))
                                .join()
                                .replaceAll(',', '')
                            +`: ImageVector = `+it.vector.replaceAll("\n", "\n    ")
                    }).join('\n')) + `
            }
            `
    )

    for (const androidVector of androidVectors) {
        write("./output/android/ic_"+(
            androidVector.name
                .replaceAll(' ', '_')
                .split(",")
                .map(it => it.replaceAll(/.+?=/g, ''))
                .join()
                .replaceAll(',', '_')
                .toLowerCase()
        ) +".xml", androidVector.vector)
    }

    for (const vector of jsVectors) {
        write("./packages/@znui/icons/src/"+vector.name+".tsx", vector.vector)
    }

    write("./packages/@znui/icons/src/index.tsx", jsVectors.map(vector =>
        'export { default as '+vector.name+' } from "./'+vector.name+'"'
    ).join(";\n"))

    console.log("> TypeScript Compile")
    shell.exec("npm run --prefix ./packages/@znui/icons compile")
})

function clean() {
    remove("./output/jetpack/ZnIcons.kt")

    for (const file of fs.readdirSync("./output/android")) {
        remove(path.join("./output/android", file));
    }

    for (const file of fs.readdirSync("./packages/@znui/icons/src")) {
        remove(path.join("./packages/@znui/icons/src", file));
    }

    for (const file of fs.readdirSync("./packages/@znui/icons/dist")) {
        remove(path.join("./packages/@znui/icons/dist", file));
    }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function generateReactIcon(name, svg) {
    return transform(
        svg,
        {
            plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx', '@svgr/plugin-prettier'],
            icon: true,
            exportType: 'default',
            replaceAttrValues: {
                '#000': 'currentColor'
            },
            svgoConfig: {
                removeViewBox: true
            }
        },
        {
            componentName: name,
        },
    )
}

function generateAndroidImageVector(name, svg) {
    const props = svg.children[0].properties
    let code = `
        <vector 
            xmlns:android="http://schemas.android.com/apk/res/android"
            android:width="${props.width}dp"
            android:height="${props.height}dp"
            android:viewportWidth="${props.width}"
            android:viewportHeight="${props.height}">
    `

    for (const child of svg.children[0].children) {
        const onParam = (name, action) => child.properties.hasOwnProperty(name) && action(child.properties[name])

        switch (child.tagName) {
            case "path":
                code += "<path";
                onParam("d", d => {
                    code += " android:pathData=\""+d+"\"";
                })

                if(child.properties.hasOwnProperty("fill-rule"))
                    code += " android:fillType=\""+child.properties['fill-rule'].replace('o', 'O')+"\"";

                code += " android:fillColor=\"#000000\"/>";
        }
    }

    code += "</vector>";
    return code.trim().replace(/\R/g, "");
}

function generateKotlinImageVector(name, svg) {
    const parameterize = (param) => {
        if(typeof param === 'string')
            return '"'+param+'"'
        else if(typeof param === 'number') {
            return param + 'f'
        }
    }

    const buildFunction = (name, params) => {
        return name + "("
            + params.map(parameterize).join(", ")
            + ")"
    }

    let code = ""
    for (const child of svg.children[0].children) {
        const onParam = (name, action) => child.properties.hasOwnProperty(name)&&action(child.properties[name])

        switch (child.tagName) {
            case "path":
                code += "    path(\n"
                onParam("fill", it => code += "        fill=SolidColor(Color."+capitalizeFirstLetter(it)+"),\n")
                onParam("stroke", it => code += "        stroke=SolidColor(Color."+capitalizeFirstLetter(it)+"),\n")
                onParam("stroke-width", it => code += "        strokeLineWidth="+parameterize(it)+",\n")

                code += "){\n"

                onParam("d", d => {
                    for (const pathElement of parsePath(d)) {
                        code += "        "
                        switch (pathElement.code) {
                            case "L":
                                code += buildFunction(
                                    "lineTo",
                                    [pathElement.x, pathElement.y]
                                ) + "\n"
                                break;

                            case "M":
                                code += buildFunction(
                                    "moveTo",
                                    [pathElement.x, pathElement.y]
                                ) + "\n"
                                break;

                            case "V":
                                code += buildFunction(
                                    "verticalLineTo",
                                    [pathElement.y]
                                ) + "\n"
                                break;

                            case "H":
                                code += buildFunction(
                                    "horizontalLineTo",
                                    [pathElement.x]
                                ) + "\n"
                                break;

                            case "C":
                                code += buildFunction(
                                    "curveTo",
                                    [
                                        pathElement.x1,
                                        pathElement.y1,
                                        pathElement.x2,
                                        pathElement.y2,
                                        pathElement.x,
                                        pathElement.y,
                                    ]
                                ) + "\n"
                                break;

                            case "Z":
                                code += buildFunction(
                                    "close",
                                    []
                                ) + "\n"
                                break;

                            default:
                                const message = name+": Action "+pathElement.command+" not supported"
                                console.warn(message)
                                code += "println("+parameterize(message)+")\n"
                        }
                    }
                })

                code += "        close()\n"
                code += "}\n"


                break;

            default:
                const message = name+": Tag "+child.tagName+" not supported"
                console.warn(message)
                code += "    path() { println("+parameterize(message)+"); close() }\n"
        }
    }

    return "materialIcon(name = "+parameterize(name)+") {\n"
        +code.replaceAll("\n", "\n    ")
    +"}\n"
}